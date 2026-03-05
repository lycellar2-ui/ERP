# KPI — KPI Target Management (Quản Lý Chỉ Tiêu)
> Thiết lập và theo dõi chỉ tiêu kinh doanh đa chiều. Hiển thị tiến độ real-time trên CEO Dashboard.

---

## 1. Mục Tiêu

Cho phép CEO/Management:
1. **Setup chỉ tiêu** theo nhiều tiêu chí, nhiều kỳ, nhiều chiều phân tích
2. **Dashboard theo dõi tiến độ** — real-time, trực quan
3. **Alert tự động** khi tiến độ thấp hơn ngưỡng kế hoạch

---

## 2. Các Loại Chỉ Tiêu (KPI Types)

### 2.1 Tài Chính
| KPI | Đơn vị | Mô tả |
|---|---|---|
| `REVENUE` | VND | Doanh thu thuần |
| `GROSS_MARGIN` | % | Tỷ lệ lợi nhuận gộp |
| `COGS` | VND | Giá vốn hàng bán |
| `NEW_CUSTOMER_REVENUE` | VND | Doanh thu từ khách mới |
| `OUTSTANDING_AR` | VND | Công nợ phải thu (Target: giảm xuống) |

### 2.2 Về Khối Lượng
| KPI | Đơn vị | Mô tả |
|---|---|---|
| `VOLUME_BOTTLES` | Chai | Số chai bán ra |
| `VOLUME_CASES` | Thùng | Số thùng bán ra |
| `ORDERS_COUNT` | SO | Số đơn hàng |
| `NEW_CUSTOMERS` | KH | Số khách hàng mới |

### 2.3 Về Hoạt Động
| KPI | Đơn vị | Mô tả |
|---|---|---|
| `INVENTORY_TURNOVER` | Vòng | Vòng quay hàng tồn kho |
| `FILL_RATE` | % | Tỷ lệ giao đơn đúng hạn |
| `TASTING_EVENTS` | Buổi | Số sự kiện tasting tổ chức |
| `CONSIGNMENT_ACTIVE` | KH | Số điểm consignment đang hoạt động |

---

## 3. Chiều Phân Tích (Dimensions)

Mỗi KPI có thể được thiết lập theo các chiều:

| Chiều | Ví dụ |
|---|---|
| **Toàn công ty** | Tổng doanh thu tháng = 5 tỷ |
| **Theo Sales Rep** | Nhân viên A: 1.5 tỷ, Nhân viên B: 2 tỷ |
| **Theo Kênh** | HORECA: 3 tỷ, Wholesale: 1.5 tỷ, Retail: 0.5 tỷ |
| **Theo Sản phẩm** | Category Bordeaux: 2 tỷ |
| **Theo Khu vực** | HCM: 4 tỷ, HN: 1 tỷ |

---

## 4. Kỳ Theo Dõi (Periods)

| Kỳ | Mô tả |
|---|---|
| `MONTHLY` | Chỉ tiêu tháng (phổ biến nhất) |
| `QUARTERLY` | Theo quý (Q1/Q2/Q3/Q4) |
| `ANNUAL` | Chỉ tiêu cả năm (kế hoạch tổng) |
| `CUSTOM` | Kỳ tùy chỉnh (Ví dụ: Campaign tháng 12) |

---

## 5. Giao Diện Setup Chỉ Tiêu

### 5.1 Màn Hình Nhập Chỉ Tiêu
```
┌─────────────────────────────────────────────────┐
│ Setup Chỉ Tiêu — Năm 2026                       │
├─────────────────────────────────────────────────┤
│ Kỳ:   [Tháng ▼]   Năm: [2026 ▼]               │
│                                                  │
│           T1      T2      T3    ... T12   TỔNG  │
│ Doanh thu  4.5T   3.5T   5.0T  ...  8.0T  60T  │
│ Margin %  27%    27%    28%   ...  30%   28.5%  │
│ Volume    1,200  950   1,350  ... 2,100  15,000 │
│ KH Mới    3      2      5    ...   8      50    │
│                                                  │
│ [Copy từ năm 2025] [Import Excel] [Lưu]         │
└─────────────────────────────────────────────────┘
```

### 5.2 Chỉ Tiêu Theo Sales Rep
```
┌──────────────────────────────────────────────────────┐
│ Chỉ tiêu Sales Rep — Tháng 03/2026                  │
├──────────────┬──────────┬──────────┬──────────────── │
│ Sales Rep    │ Doanh thu│ Volume   │ KH Mới          │
├──────────────┼──────────┼──────────┼──────────────── │
│ Nguyễn Lan   │  1.8T    │  480 chai│  2              │
│ Trần Minh    │  2.0T    │  550 chai│  3              │
│ Lê Thu       │  1.2T    │  320 chai│  1              │
│ TỔNG         │  5.0T    │ 1,350    │  6              │
└──────────────┴──────────┴──────────┴──────────────── │
```

---

## 6. Dashboard Tiến Độ (Progress Display)

### 6.1 Progress Bar Cards trên CEO Dashboard
```
DOANH THU THÁNG 03/2026
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 82%    Thực: ₫2.34T / KH: ₫2.85T
Còn lại: ₫510,000,000  |  Còn 12 ngày làm việc
Dự báo cuối tháng: ₫2.72T  → Thiếu ₫130M nếu giữ tốc độ

GROSS MARGIN
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░ 91%    Thực: 28.6% / KH: 29.5%
```

### 6.2 Alert Thresholds
| Mức | Màu | Điều kiện |
|---|---|---|
| 🟢 On-track | Xanh | Tiến độ ≥ 90% so với kế hoạch tuyến tính |
| 🟡 At-risk | Vàng | Tiến độ 70–89% |
| 🔴 Behind | Đỏ | Tiến độ < 70% |
| ⚫ Exceeded | Vàng đặc biệt | Tiến độ > 110% |

---

## 7. Dự Báo Cuối Kỳ (Forecast)

Hệ thống tự động tính:
```
Dự báo = Thực tế đã đạt × (Tổng ngày kỳ / Ngày đã qua)
```
Kết hợp với AI có thể dùng moving average hoặc weighted forecast.

---

## 8. Database Design

```
KpiTarget {
  id, name, kpi_type, dimension_type (COMPANY|REP|CHANNEL|...),
  dimension_id (null = Company level),
  period_type (MONTHLY|QUARTERLY|ANNUAL|CUSTOM),
  year, month?, quarter?,
  start_date, end_date,
  target_value, unit (VND|PERCENT|COUNT|BOTTLE),
  created_by, created_at
}

KpiActual {
  id, kpi_target_id,
  actual_value,
  recorded_at (snapshot date),
  data_source (AUTO | MANUAL)
}

KpiAlert {
  id, kpi_target_id,
  alert_type (AT_RISK | BEHIND | EXCEEDED),
  triggered_at, read_at
}
```

### Auto-calculation
Hệ thống chạy **Cron job mỗi ngày** query actual values từ:
- `SalesOrder` → `REVENUE`, `VOLUME`
- `LandedCostAllocation` + `SalesOrderLine` → `GROSS_MARGIN`
- `Customer` (created_at trong kỳ) → `NEW_CUSTOMERS`
- Etc.

*Last updated: 2026-03-04 | Wine ERP v4.0*
