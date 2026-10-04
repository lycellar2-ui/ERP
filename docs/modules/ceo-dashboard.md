# CEO Executive Dashboard — DSH
**Module:** `DSH` | Người dùng: CEO | Ưu tiên: 🟢 P3

Dashboard là **bảng điều khiển sức khỏe doanh nghiệp** — không phải chỉ báo cáo số liệu, mà là nơi CEO *ra quyết định* và *phê duyệt* mà không cần mở module nào khác. Thiết kế theo nguyên tắc: **Maximum information, minimum clicks.**

---

## 1. Cấu Trúc Layout

Dashboard chia thành 4 hàng theo mức độ ưu tiên:

```
ROW 1 — KPI Snapshot (Always visible, always updated)
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Doanh Thu│ │Gross     │ │Tồn Kho   │ │Đơn Chờ  │
│ Tháng    │ │Margin    │ │Giá Trị   │ │Duyệt    │
│ MTD      │ │MTD %     │ │Hiện Tại  │ │         │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

ROW 2 — Charts (Trend & Breakdown)
┌──────────────────────┐ ┌────────────────────────┐
│ Doanh Thu 12 Tháng   │ │ Breakdown Kênh (Pie)   │
│ (Line Chart, YoY)    │ │ HORECA/Đại lý/VIP      │
└──────────────────────┘ └────────────────────────┘

ROW 3 — Operations (Cảnh báo vận hành)
┌────────────────┐ ┌────────────────┐ ┌────────────┐
│ Container      │ │ AR Aging       │ │ Slow-moving│
│ In-Transit     │ │ Overview       │ │ Stock Alert│
│ (ETA list)     │ │ (Bar chart)    │ │            │
└────────────────┘ └────────────────┘ └────────────┘

ROW 4 — Action Required (CEO phải làm gì)
┌─────────────────────────────────────────────────┐
│ ⏳ Chờ CEO Duyệt (Pending Approvals)             │
│  • PO #2403 - NCC Bordeaux Negoce — 145M VND    │
│  • SO #9821 - Discount 18% — Park Hyatt         │
│  • Write-off #W-042 — 3 chai bể vỡ              │
│                              [Xem tất cả →]     │
└─────────────────────────────────────────────────┘

ROW 5 — Legal & Compliance (Cảnh báo tuân thủ pháp lý)
┌─────────────────────────────────────────────────┐
│ 🛡️ Cảnh Báo Tuân Thủ                    (3 GT) │
│  🔴 PCCC - GCN Đủ ĐK        Quá hạn 5 ngày     │
│  🟡 GP Phân phối rượu        Còn 22 ngày        │
│  🟢 VSATTP                   Còn 87 ngày        │
│                        [Xem tất cả →]            │
└─────────────────────────────────────────────────┘
```

---

## 2. KPI Cards Chi Tiết (Row 1)

### Card 1: Doanh Thu Tháng (MTD Revenue)
- **Số chính:** Tổng doanh thu tháng hiện tại (VND, DM Mono font)
- **So sánh:** % tăng/giảm so với tháng trước + so với cùng kỳ năm ngoái
- **Progress bar:** % đạt KPI tháng (nếu có set target)
- **Cập nhật:** Real-time qua Supabase Realtime khi SO → Delivered

### Card 2: Gross Margin MTD
- **Số chính:** % Gross Margin tháng này
- **Phụ:** Margin tuyệt đối (VND)
- **Trend:** Mũi tên so sánh tháng trước
- **Alert:** Đỏ nếu margin < ngưỡng cài sẵn (ví dụ: < 20%)

### Card 3: Giá Trị Tồn Kho
- **Số chính:** Tổng Inventory Value = Σ(qty × unit_landed_cost) VND
- **Phụ:** Số SKU hiện có / Số ngày tồn trung bình
- **Breakdown:** On-hand vs Consigned (ký gửi)

### Card 4: Đơn Chờ Duyệt
- **Số chính:** Tổng số chứng từ chờ CEO duyệt (Badge đỏ)
- **Breakdown:** PO / SO / Write-off / Discount Override
- **CTA:** Click → Scroll xuống Row 4 (Pending Approvals)

---

## 3. Charts (Row 2)

### Chart 1: Doanh Thu 12 Tháng (Line Chart)
- 2 đường: Năm hiện tại vs Năm ngoái (YoY)
- Hover tooltip: Số VND chính xác, % growth
- Click vào tháng → Drill down vào RPT module với filter tháng đó

### Chart 2: Breakdown Theo Kênh (Donut Chart)
- HORECA / Wholesale Đại lý / VIP Retail
- Hiển thị % và số tuyệt đối
- Animated khi tải trang (Graceful entrance)

---

## 4. Operations Widgets (Row 3)

### Widget 1: Container In-Transit (Đang Trên Biển)
Dữ liệu từ AGN (Agency Portal) — Agency cập nhật ETA:
```
🚢 3 containers đang về
  B/L: MAEU123... | Dự kiến: 12/03 | CIF: $42,000
  B/L: OOLU456... | Dự kiến: 18/03 | CIF: $28,500
  B/L: EVER789... | Dự kiến: 25/03 | CIF: $61,000
                    Tổng thuế dự kiến: ~₫ 280M
```
Giúp CEO chuẩn bị dòng tiền nộp thuế NK trước.

### Widget 2: AR Aging Overview (Bar Chart)
- 4 cột: 0-30 ngày / 30-60 / 60-90 / >90 ngày quá hạn
- Màu từ xanh → đỏ theo mức độ rủi ro
- Click → Mở RPT module AR Aging chi tiết

### Widget 3: Slow-moving Alert
- SKU không xuất kho > 180 ngày (Cảnh báo đỏ)
- Tổng giá trị vốn đang bị kẹt
- Top 5 SKU chậm nhất với nút "Xem chi tiết"

---

## 5. Pending Approvals Widget (Row 4)

**Đây là tính năng quan trọng nhất của Dashboard CEO:**
- Hiển thị dạng danh sách gọn, mỗi item 1 hàng
- Thông tin đủ để duyệt luôn mà không cần mở PO/SO: Đối tác, số tiền, loại, người tạo
- 2 nút ngay trong widget: `✅ Duyệt` và `❌ Từ Chối (kèm lý do)`
- Sau khi click → Optimistic UI update ngay, background xử lý state machine

---

## 6. Time Filter Toàn Cục

Góc trên phải: **Date Range Picker** — Thay đổi kỳ thời gian sẽ cập nhật **tất cả** widget và chart cùng lúc:
- Quick select: Hôm nay / Tuần này / Tháng này / Quý này / Năm này
- Custom range picker cho phân tích ad-hoc

---

## 7. Bảo Mật

- Route `/dashboard` — Chỉ Role `CEO` và `DIRECTOR` truy cập
- **Số Gross Margin và Giá Vốn** — Chỉ CEO thấy, các role khác thấy dashboard riêng với dữ liệu cắt giảm
- Export dữ liệu Dashboard — Chỉ CEO mới có nút Export
- Supabase RLS: Query Dashboard chạy dưới service role của server, không expose raw data xuống client
- Session timeout 8 tiếng (Tự logout nếu idle)

---

## 8. Real-time Update Strategy

| Dữ liệu | Cập nhật cách | Interval |
|---|---|---|
| KPI Revenue | Supabase Realtime subscription | Ngay khi SO status = DELIVERED |
| Inventory Value | Revalidate on demand | Khi GR hoặc DO confirm |
| Pending Approvals | Supabase Realtime | Ngay khi ApprovalRequest tạo |
| In-transit ETA | Polling | 30 phút/lần (Agency không update liên tục) |
| AR Aging | Scheduled revalidate | 1 lần/ngày lúc 6am |

---

## 9. Báo Cáo Lãi Lỗ Tóm Tắt (P&L Summary — CEO View)

> **Yêu cầu quan trọng nhất:** CEO phải biết ngay công ty đang lãi hay lỗ, bao nhiêu, tại sao.

Dashboard có tab **"Tài Chính"** hiển thị P&L summary dạng đơn giản, trực quan:

```
╔══════════════════════════════════════════════════════╗
║  KẾT QUẢ KINH DOANH — Tháng 03/2026                ║
╠══════════════════════════════════════════════════════╣
║  (+) Doanh thu thuần              ₫  2,340,000,000  ║
║  (-) Giá vốn hàng bán (COGS)     ₫  1,670,820,000  ║
║  ─────────────────────────────────────────────────  ║
║  (=) LỢI NHUẬN GỘP               ₫    669,180,000  ║ ← 28.6%
║                                                      ║
║  (-) Chi phí bán hàng             ₫    180,000,000  ║
║  (-) Chi phí quản lý              ₫    120,000,000  ║
║  (-) Chi phí lãi vay              ₫     25,000,000  ║
║  ─────────────────────────────────────────────────  ║
║  (=) LỢI NHUẬN TRƯỚC THUẾ        ₫    344,180,000  ║ ← 14.7%
║  (-) Thuế TNDN (20%)              ₫     68,836,000  ║
║  ─────────────────────────────────────────────────  ║
║  (=) LỢI NHUẬN SAU THUẾ          ₫    275,344,000  ║ 🟢 +11.8%
╚══════════════════════════════════════════════════════╝
```

**So sánh:** Tháng trước | Cùng kỳ năm ngoái | KPI tháng này

---

## 10. Vị Thế Tiền Mặt (Cash Position)

```
╔══════════════════════════════════════════════════════╗
║  DÒNG TIỀN — Ước tính đến ngày 04/03/2026           ║
╠══════════════════════════════════════════════════════╣
║  Tiền đầu tháng                   ₫  1,850,000,000  ║
║                                                      ║
║  (+) Thu từ khách hàng (AR)       ₫  2,100,000,000  ║
║  (-) Trả NCC / Thuế NK            ₫  1,540,000,000  ║
║  (-) Chi phí vận hành             ₫    280,000,000  ║
║  ─────────────────────────────────────────────────  ║
║  Tiền hiện tại (ước tính)         ₫  2,130,000,000  ║
║                                                      ║
║  ⚠️  NGHĨA VỤ SẮP ĐẾN (30 ngày tới):               ║
║  • Thuế NK container MAEU12X3      ₫   -180,000,000  ║ Due 15/03
║  • Thanh toán NCC Bordeaux L/C     ₫   -850,000,000  ║ Due 20/03
║  • VAT tháng 02 nộp               ₫    -95,000,000  ║ Due 25/03
║  ─────────────────────────────────────────────────  ║
║  Dự kiến tiền cuối tháng          ₫  1,005,000,000  ║ 🟡 Chú ý
╚══════════════════════════════════════════════════════╝
```

---

## 11. Cơ Cấu Chi Phí (Cost Structure)

Biểu đồ Waterfall / Stacked Bar cho CEO thấy các loại chi phí:

| # | Loại Chi Phí | Ví dụ | Nguồn Dữ Liệu |
|---|---|---|---|
| 1 | **Giá vốn hàng (COGS)** | Landed Cost × Qty sold | FIN - Journal (632) |
| 2 | **Chi phí thuế** | Thuế NK + TTĐB + VAT | PRC - LandedCost |
| 3 | **Chi phí logistics** | Phí cảng, xe tải, kho lạnh | AGN - Submissions |
| 4 | **Chi phí bán hàng** | Lương sales, commission, tasting | FIN - Manual entry |
| 5 | **Chi phí quản lý** | Lương văn phòng, thuê mặt bằng | FIN - Manual entry |
| 6 | **Chi phí hư hỏng** | Write-off chai bể/hỏng | WMS - Write-off |
| 7 | **Lãi vay** | Vay ngân hàng nhập hàng | FIN - Manual entry |

→ CEO thấy **từng khoản chiếm bao nhiêu % doanh thu** và so sánh với tháng trước.

---

## 12. KPI Tiến Độ Chỉ Tiêu (từ KPI module)

Row mới trên Dashboard — Progress bars theo từng chỉ tiêu tháng:

```
Doanh thu    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  78%   ₫2.34T / KH ₫3.0T
Gross Margin ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░  91%   28.6% / KH 31.5%
Volume       ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░  68%   918 chai / KH 1,350
KH Mới       ▓▓▓▓▓▓▓▓░░░░░░░░░░░░  40%   2 KH / KH 5
```

*Last updated: 2026-03-08 | Wine ERP v6.0*

---

## 13. Legal & Compliance Widget (Row 5)

> Triển khai 08/03/2026. Nằm sau Quick Links, trước My Sales.

### Thiết kế
- **Header:** Biểu tượng Shield + "Cảnh Báo Tuân Thủ" + badge `{count} giấy tờ`
- **Badge color:** Đỏ nếu có item severity=critical, Vàng nếu chỉ có warning
- **Action:** Nút "Xem tất cả →" dẫn về `/dashboard/contracts` (tab Giấy Tờ Có Hạn)
- **Max hiển thị:** 8 items (sort by `expiryDate ASC`)

### Mỗi row cảnh báo
- **Icon:** ⚠️ AlertTriangle với màu theo severity
- **Severity levels:**
  - 🔴 **critical:** Đã quá hạn (daysRemaining ≤ 0) hoặc ≤ 7 ngày
  - 🟡 **warning:** Còn 8-30 ngày
  - 🟢 **info:** Còn 31-60 ngày  
- **Thông tin:** Tên giấy tờ, loại (labels VN), mã số, ngày còn lại, message
- **Color coding:** Border + icon + text color matching severity

### Data Source
- Server action: `getComplianceWarnings()` from `reg-doc-actions.ts`
- Fetch condition: chỉ khi `dashConfig.sections` chứa `'legal_compliance'`
- Auto-expire cron: `/api/cron/compliance` — chạy 1 AM hàng ngày
- Roles được thấy: `CEO`, `THU_MUA`

### Liên kết Module
```
RegulatedDocument (CNT) ────→ ComplianceWidget (DSH)
         ↑                              ↑
    reg-doc-actions.ts           page.tsx (dashboard)
    reg-doc-constants.ts         actions.ts (DashboardSection)
```

---

## 14. Implementation Status (Trạng Thái Triển Khai)

> Cập nhật 08/03/2026 — **Hoàn thiện 100%**

| Widget / Tính năng | Server Action | Trạng thái |
|---|---|---|
| KPI Cards (4 cards) | `getDashboardStats` | ✅ Done |
| Revenue Chart + YoY | `getMonthlyRevenue`, `getRevenueYoY` | ✅ Done |
| P&L Summary | `getPLSummary` | ✅ Done |
| Cash Position | `getCashPosition` | ✅ Done |
| AR Aging Chart | `getARAgingChart` | ✅ Done |
| Cost Waterfall | `getCostWaterfall` | ✅ Done |
| Pending Approvals | `getPendingApprovalDetails` | ✅ Done |
| Shipment Tracker | Inline in `page.tsx` | ✅ Done |
| KPI Targets Progress | `getKpiSummary` | ✅ Done |
| Quick Links (Role-based) | `getDashboardConfig` | ✅ Done |
| Export Excel | `exportDashboardExcel` | ✅ Done |
| My Sales (Sales Rep) | `getMySales` | ✅ Done |
| Warehouse Summary | `getWarehouseDashboard` | ✅ Done |
| **Legal & Compliance** | `getComplianceWarnings` | ✅ Done |
| **Cron Auto-Expire** | `/api/cron/compliance` | ✅ Done |
| Role-based sections | `ROLE_DASHBOARD` config | ✅ 8 roles |
| Realtime channels | `getRealtimeChannels` | ✅ Done |
| **Tờ Trình — Đề Xuất** | `getPendingProposalsForCEO` | ✅ Done |
| **SO Approve/Reject** | `approveSalesOrder`, `rejectSalesOrder` | ✅ Done |
| **PO Approve/Reject** | `updatePOStatus` (enhanced StatusStepper) | ✅ Done |
| **Ma Trận Phân Quyền** | `/dashboard/settings/approval-matrix` | ✅ Done |
| **Top Khách Hàng** | `getTopCustomers` | ✅ **MỚI v2** |
| **Top Sản Phẩm** | `getTopProducts` | ✅ **MỚI v2** |
| **Kênh Bán Hàng** | `getRevenueByChannel` | ✅ **MỚI v2** |

---

## Layout v2 — "Command Center" (08/03/2026)

Dashboard được redesign từ 11 sections dọc → **5 layers logic**, giảm ~50% scroll:

```
╔══════════════════════════════════════════════════════════════╗
║ LAYER 1: HEADLINE — 6 KPI Cards                            ║
║ Doanh Thu | Lãi Gộp | Dòng Tiền | Tồn Kho | Công Nợ | Duyệt║
╠══════════════════════════════════════════════════════════════╣
║ LAYER 2: FINANCIAL PULSE — 2 cột                           ║
║ [P&L Tháng]              | [Vị Thế Tiền Mặt]              ║
╠══════════════════════════════════════════════════════════════╣
║ LAYER 3: OPERATIONS — 3 cột                                ║
║ [Container Tracker] | [AR Aging] | [Top KH + Top SP]       ║
╠══════════════════════════════════════════════════════════════╣
║ LAYER 4: CEO ACTION — Unified Approval Hub                  ║
║ Tờ trình + Approval Engine + Pending SOs                    ║
╠══════════════════════════════════════════════════════════════╣
║ LAYER 5: DEEP ANALYSIS                                      ║
║ [KPI Targets] + [Kênh Bán Hàng]                            ║
║ [Revenue YoY] + [Cost Waterfall]                            ║
║ [Cảnh Báo Tuân Thủ]                                        ║
║ [Quick Links] (cuối trang)                                  ║
╚══════════════════════════════════════════════════════════════╝
```

### Thay đổi chính so với v1:
- **4 → 6 KPI Cards**: Thêm Lãi Gộp, Dòng Tiền Ròng, Công Nợ Phải Thu
- **P&L + Cash**: 2 cột ngang thay vì 3 cột (bỏ AR Aging ra riêng)
- **Top KH/SP**: Widget mới — Top 5 Khách Hàng + Top 5 Sản Phẩm bán chạy
- **Kênh Bán Hàng**: Breakdown doanh thu HORECA/Wholesale/VIP Retail
- **Quick Links**: Di chuyển xuống cuối trang (không gây gián đoạn flow)
- **Deep Analysis**: Gom YoY, Cost Waterfall, KPI, Legal vào 1 section

---

## Tính Năng v3 — "Dynamic Filtering & Daily Sales Trend" (04/09/2026)

Bổ sung tính năng phân tích đa chiều theo thời gian thực cho CEO:

### 1. Thanh Bộ Lọc Tham Số (`DashboardFilterBar.tsx`)
- **Mốc thời gian nhanh (Date Presets)**:
  - `Hôm nay` (`TODAY`)
  - `Hôm qua` (`YESTERDAY`)
  - `7 ngày qua` (`7DAYS`)
  - `Tháng này` (`THIS_MONTH` - mặc định)
  - `Tháng trước` (`LAST_MONTH`)
  - `Tùy chọn...` (`CUSTOM`): Nhập trực tiếp khoảng ngày `[Từ ngày ... Đến ngày ...]`.
- **Lọc theo Pháp nhân (Legal Entity)**:
  - `Tất cả pháp nhân`: Doanh số hợp nhất toàn công ty.
  - `[TA] CÔNG TY CỔ PHẦN THƯƠNG MẠI THẮNG ÂN`.
  - `[LC] CÔNG TY TNHH HẦM RƯỢU LY'S`.
- **Đồng bộ trạng thái**: Tích hợp `useTransition` và URL searchParams (`?preset=...&entity=...&from=...&to=...`) giúp chuyển đổi mượt mà không load lại trang.

### 2. Biểu Đồ Doanh Số Từng Ngày (`DailyRevenueChart.tsx`)
- **Biểu đồ cột trực quan**: Thể hiện doanh thu và số đơn hàng cho từng ngày trong kỳ lọc.
- **Tự động nhận diện ngày cao điểm (Peak Day)**: Đánh dấu vàng kim và hiệu ứng ánh sáng cho ngày đạt doanh thu kỷ lục.
- **Phân biệt ngày cuối tuần (T7, CN)**.
- **Rê chuột xem chi tiết (Interactive Tooltip)**: Hiển thị thứ, ngày, doanh thu chính xác (VND) và số đơn phát sinh.
- **Chế độ xem 1 ngày (Hôm nay / Hôm qua)**: Hiển thị thẻ tóm tắt doanh số và số đơn trong ngày.
- **4 chỉ số tóm tắt nhanh**:
  - Tổng Doanh Số Kỳ
  - Tổng Số Đơn Hàng
  - Giá Trị Đơn Trung Bình (AOV)
  - Ngày Đạt Đỉnh Doanh Thu

### 3. Cập nhật Backend Actions (`src/app/dashboard/actions.ts`)
- `DashboardFilterOptions { from?: Date; to?: Date; legalEntityId?: string }`
- `getDailyRevenueChart(options)`: Tổng hợp doanh số từng ngày và ngày đỉnh.
- `getDashboardStats`, `getPLSummary`, `getTopCustomers`, `getTopProducts`, `getRevenueByChannel`: Nhận tham số lọc linh hoạt theo kỳ và theo pháp nhân.

---

## Tính Năng v4 — "Customer 360° Purchase History & Search" (04/10/2026)

Tích hợp trực tiếp widget tra cứu và phân tích lịch sử nhập hàng của từng khách hàng ngay trên tab Dashboard chính (`/dashboard`):

### 1. Widget Tra Cứu Khách Hàng 360° (`CustomerOrderHistoryWidget.tsx`)
- **Vị trí**: Đặt trực tiếp dưới Layer 3 (Operations & Top Khách Hàng).
- **Thanh tìm kiếm khách hàng nhanh (Search Autocomplete)**: Tìm kiếm tức thì theo tên, mã khách hàng (`KH-...`), hoặc số điện thoại.
- **Thanh nút bấm chọn nhanh Top Khách Hàng (Quick Pills)**: 1 chạm để chuyển ngay qua hồ sơ mua sắm của các khách hàng có doanh số cao nhất kỳ.
- **Hỗ trợ cơ cấu Công ty Mẹ - Chi nhánh con**: Khi chọn công ty Mẹ (Holding), tự động tổng hợp toàn bộ lịch sử đơn hàng của các nhà hàng/chi nhánh con và ghi chú rõ chi nhánh phát sinh đơn.

### 2. Hồ Sơ Khách Hàng & 4 Thẻ Chỉ Số Trực Quan
- **Khung thông tin khách hàng**: Mã khách, Tên đầy đủ, Kênh bán hàng (HORECA, WHOLESALE,...), Nhân viên phụ trách (Sales Rep), Thuộc công ty mẹ nào, Điều khoản thanh toán (NET30, NET60) & Hạn mức tín dụng.
- **Bộ lọc thời gian riêng cho khách hàng**: Tất cả (All-time), Năm nay, 6 tháng qua, Tháng này.
- **4 Thẻ KPIs**:
  1. *Tổng tiền đã nhập*: Doanh thu tích lũy (VND).
  2. *Đơn hàng & Sản lượng*: Tổng số đơn SO và tổng số chai đã mua, trung bình chai/đơn.
  3. *Lần mua gần nhất*: Ngày đặt đơn gần nhất và mã đơn SO tương ứng.
  4. *Dư nợ phải thu (AR)*: Công nợ hiện tại kèm cảnh báo nếu có nợ quá hạn.

### 3. Cấu Trúc 3 Tabs Chuyên Sâu
- **Tab 1: Lịch Sử Đơn Hàng (Sales Orders)**:
  - Bảng danh sách các đơn hàng đã đặt: Mã SO, Ngày đặt, Chi nhánh, Sale phụ trách, Số lượng chai & SKU, Tổng tiền, Trạng thái SO, Trạng thái giao hàng DO, Mã hóa đơn VAT.
  - Nút mũi tên mở rộng chi tiết (Expandable row): Xem ngay bảng danh sách các chai rượu, số lượng, đơn giá, chiết khấu và thành tiền trong đơn mà không cần rời Dashboard.
  - Bộ lọc trạng thái đơn: Tất cả, Đã giao đủ, Đã thanh toán, Chờ xử lý.
- **Tab 2: Rượu Đã Từng Mua (Wine Profile)**:
  - Bảng danh mục toàn bộ các dòng rượu/SKU khách từng nhập.
  - Ô tìm kiếm/lọc nhanh tên rượu, SKU, xuất xứ.
  - Thông tin: Mã SKU, Tên vang, Loại vang, Xuất xứ/quốc gia, Tổng chai đã mua, Đơn giá mua lần cuối, Tổng tiền đã chi, Lần mua gần nhất.
- **Tab 3: Xu Hướng Nhập Hàng (Monthly Trend)**:
  - Biểu đồ thanh doanh thu và sản lượng chai qua từng tháng, giúp CEO và Sales đánh giá mức độ tăng trưởng hoặc giảm sút đơn hàng của khách.

### 4. Backend Actions Bổ Sung (`src/app/dashboard/actions.ts`)
- `searchCustomersForDashboard(query: string)`: Tìm kiếm top 20 khách hàng active phù hợp.
- `getCustomerPurchaseHistory(customerId: string, timeRange?: 'ALL' | 'THIS_YEAR' | 'LAST_6_MONTHS' | 'THIS_MONTH')`: Tính toán toàn bộ KPIs, gom nhóm SKU, tổng hợp công nợ AR và biểu đồ xu hướng theo tháng.
- `getTopCustomers(limit, options)`: Bổ sung `id` và `code` để liên kết trực tiếp với widget Customer 360.

---

## Tính Năng v5 — "Tab Riêng Phân Tích Khách Hàng, Cơ Chế Giá & Bảng Giá Đặc Biệt" (04/10/2026)

Nâng cấp Dashboard thành hệ thống 2 Tab độc lập, chuyên sâu theo phản hồi thực tế của ban điều hành:
`[📊 Tổng Quan Điều Hành]` (Executive Overview) vs `[👥 Hồ Sơ & Cơ Chế Giá Khách Hàng (Customer 360°)]` (`tab=overview` / `tab=customers`).

### 1. Kiến Trúc 2 Tab Độc Lập
- **Tab 1: Tổng Quan Điều Hành**: Giữ nguyên vẹn nhịp đập tài chính P&L, dòng tiền, bảng AR Aging, container đang về, biểu đồ doanh thu theo ngày và Action Hub chờ CEO duyệt. Loại bỏ widget chèn giữa để màn hình overview luôn sắc nét, gọn gàng và tải tức thì.
- **Tab 2: Phân Tích & Cơ Chế Giá Khách Hàng**: Không gian toàn màn hình dành riêng cho việc phân tích chuyên sâu từng đối tác khách hàng (nhà hàng, đại lý, khách sạn 5 sao).

### 2. Thông Tin Cơ Chế Giá & Bảng Giá Đặc Biệt (Special Pricing & Agreements)
- **Bảng giá cơ sở & Chiết khấu mặc định**: Hiển thị chính sách giá áp dụng (`basePriceType`: BY_CHANNEL, WHOLESALE, RETAIL, HORECA) và % chiết khấu kho cố định (`defaultDiscountPct`).
- **Tờ trình cơ chế giá đã phê duyệt**: Tự động liệt kê các tờ trình điều chỉnh giá (`category: PRICE_ADJUSTMENT`, trạng thái `APPROVED` / `APPROVED_L2` / `CLOSED`) có liên quan đến khách hàng, kèm số tờ trình, tiêu đề, thời hạn hiệu lực và ghi chú.
- **Bảng giá đặc biệt theo từng SKU (`CustomerPriceRule`)**:
  - Liệt kê chi tiết giá bán riêng từng dòng rượu: Giá chuẩn niêm yết (Wholesale/Retail) vs Giá đặc biệt được duyệt.
  - Mức giảm / tiết kiệm (% chiết khấu hoặc số tiền giảm cụ thể/chai).
  - Thời hạn áp dụng (ngày bắt đầu → ngày kết thúc).
  - Trạng thái hiệu lực: Đang hiệu lực, Sắp hết hạn (cảnh báo trước 15 ngày), Đã hết hạn.

### 3. Cảnh Báo Chu Kỳ Mua Hàng & Sức Khỏe Khách Hàng (Buying Health)
- **Đo lường tần suất đặt hàng**: Tính toán số ngày kể từ đơn gần nhất (`daysSinceLastOrder`) và chu kỳ trung bình giữa các lần nhập hàng (`averageOrderCycleDays`).
- **Phân loại trạng thái**:
  - `HEALTHY`: Đặt hàng đều đặn đúng nhịp.
  - `WARNING`: Chậm đơn (vượt chu kỳ bình thường từ 1.3 đến 2.2 lần).
  - `AT_RISK`: Nguy cơ rớt khách (quá chu kỳ trên 2.2 lần) kèm số ngày trễ cụ thể để Sale phụ trách lập tức liên hệ kiểm tra menu, tồn kho của đối tác.

### 4. Bóc Tách Đơn Thương Mại vs Đơn Tasting / Hàng Mẫu
- Tách bạch rõ ràng giữa đơn bán thương mại (`STANDARD`) và đơn thử nếm/mẫu (`TASTING`, `SAMPLE`) để không làm sai lệch số liệu doanh thu thực tế và giá trị đơn hàng trung bình.
- Thống kê tỷ lệ tiền đã thu vs công nợ AR thực tế (kèm công nợ quá hạn).

### 5. Gu Rượu & Phân Khúc Giá Ưa Chuộng
- **Tỷ trọng loại vang**: Thống kê % sản lượng và doanh thu theo Vang Đỏ (Red), Vang Trắng (White), Vang Nổ/Champagne (Sparkling), Vang Hồng (Rose),...
- **Phân khúc giá**: Thống kê thói quen nhập hàng theo 3 tầm giá: Phổ thông (< 500k), Trung cấp (500k – 1.5M), và Cao cấp (> 1.5M).
- **Lịch sử đơn hàng có địa chỉ giao & người nhận**: Hiển thị rõ điểm giao hàng tại chi nhánh, người nhận hàng tại điểm, số điện thoại, ghi chú giao hàng và trạng thái hóa đơn VAT.

---

## 11. Kiến Trúc Song Ngữ (Bilingual Architecture) & Đồng Bộ Phân Hệ

Nhằm phục vụ cả Ban Giám Đốc người Việt và chuyên gia/cổ đông nước ngoài, Dashboard được trang bị đầy đủ song ngữ **Tiếng Việt & English**:

### 1. Chuẩn Hóa Thuật Ngữ Thương Mại Rượu Vang
- Toàn bộ từ ngữ đều áp dụng chuẩn ERP phân phối đồ uống quốc tế, không dùng dịch máy:
  - *Doanh thu thuần*: Period Revenue / MTD Revenue.
  - *Lãi gộp & biên lợi nhuận*: Gross Profit & Gross Margin.
  - *Dòng tiền ròng*: Net Cash Flow (Cash In / Cash Out).
  - *Công nợ phải thu & tuổi nợ*: Accounts Receivable (AR Outstanding & AR Aging).
  - *Giá niêm yết vs Giá thỏa thuận riêng*: Standard List Price vs Negotiated Special Price.
  - *Hàng mẫu & thử nếm*: Tasting / Commercial Samples.

### 2. Bộ Quản Lý Locale Trung Tâm (`src/lib/i18n.ts`)
- Quản lý đồng bộ locale toàn hệ thống qua `erp_locale`.
- **Đồng bộ đa phân hệ (Cross-Module Sync)**:
  - Tự động đồng bộ 2 chiều với `sales_visits_locale` của phân hệ Sales Đi Thị Trường.
  - Khi chuyển đổi ngôn ngữ tại Dashboard hoặc Header, hệ thống phát đồng thời 2 Custom Events: `erp_locale_change` và `sales_visits_locale_change`.
  - Đảm bảo khi CEO hoặc Sales đổi sang English tại Dashboard thì toàn bộ Header, thanh filter và phân hệ Field Visits đều đổi sang English ngay lập tức mà không bị xung đột hay reload trang.
- Nút chuyển nhanh `[VI | EN]` được tích hợp trực tiếp tại Header hệ thống và thanh điều khiển thời gian của Dashboard.



