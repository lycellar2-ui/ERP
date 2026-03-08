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
