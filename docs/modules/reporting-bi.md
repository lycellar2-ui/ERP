# RPT — Reporting & Business Intelligence (Báo Cáo & Phân Tích)

Phân hệ Reporting là nơi **toàn bộ dữ liệu từ 13 module còn lại đổ về** để biến thành thông tin ra quyết định. Không chỉ là số liệu tĩnh — mà là công cụ phân tích giúp CEO và các Trưởng phòng nhìn thấy cơ hội và rủi ro.

**Nguyên tắc thiết kế:** Excel-first (mọi báo cáo đều xuất Excel) + Flexible (Trưởng phòng tự tạo báo cáo không cần IT).

---

## 1. Kiến Trúc Báo Cáo (Report Architecture)

```
Raw Data (13 Modules)
       ↓
   Data Layer (Aggregated Views / Materialized)
       ↓
       ├── Report Builder (Tự tạo — Người dùng)
       ├── Standard Reports (Cài sẵn — 15 loại)
       └── Scheduled Reports (Tự động gửi Email)
```

---

## 2. Báo Cáo Cài Sẵn (Standard Reports — 15 Loại)

### 📦 Nhóm Kho & Tồn Kho
| # | Tên Báo Cáo | Mô Tả | Xuất |
|---|---|---|---|
| R01 | Tồn Kho Theo SKU | Số lượng + Giá trị tồn kho của từng SKU, từng kho | Excel / PDF |
| R02 | Tồn Kho Theo Vintage | Tổng hợp theo Năm thu hoạch — Biết được kho đang già hay trẻ | Excel |
| R03 | Tồn Kho Theo Lô | Chi tiết từng Batch/Lot, vị trí, ngày nhập, giá vốn | Excel |
| R04 | Slow-moving & Dead Stock | SKU không xuất kho > 90 / 180 / 365 ngày | Excel / Dashboard |
| R05 | Hàng Sắp Về (In-Transit) | Container đang trên đường, ETA, số lượng ước tính | Dashboard |

### 🛒 Nhóm Mua Hàng & Nhập Khẩu
| # | Tên Báo Cáo | Mô Tả | Xuất |
|---|---|---|---|
| R06 | Purchase Order Status | Tình trạng tất cả PO (Draft/Pending/Confirmed/Received) | Excel |
| R07 | Landed Cost Summary | Chi phí thực tế của từng lô hàng (CIF + Thuế + Logistics) | Excel |
| R08 | Thuế Đã Nộp Theo Kỳ | Tổng thuế NK, TTĐB, VAT theo Tháng/Quý/Năm | Excel (chuẩn tờ khai) |

### 💰 Nhóm Doanh Thu & Bán Hàng
| # | Tên Báo Cáo | Mô Tả | Xuất |
|---|---|---|---|
| R09 | Doanh Thu Theo Kỳ | Doanh số theo tháng/quý/năm, so sánh YoY | Excel / Chart |
| R10 | Doanh Thu Theo Kênh | Breakdown HORECA vs Đại lý vs Bán lẻ | Excel / Chart |
| R11 | Doanh Thu Theo Sales Rep | Ranking sales rep, doanh số per người | Excel |
| R12 | Phân Tích Lợi Nhuận Gộp (Margin) | Doanh thu - COGS (từ Landed Cost) = Gross Margin per SKU, per KH | Excel / Chart |

### 🤝 Nhóm Khách Hàng & Công Nợ
| # | Tên Báo Cáo | Mô Tả | Xuất |
|---|---|---|---|
| R13 | AR Aging (Công Nợ KH) | Phân tầng nợ theo 0-30 / 30-60 / 60-90 / >90 ngày | Excel / PDF |
| R14 | AP Aging (Công Nợ NCC) | Công nợ phải trả theo thời hạn L/C, T/T | Excel |

### 🍷 Nhóm Đặc Thù Rượu Vang
| # | Tên Báo Cáo | Mô Tả | Xuất |
|---|---|---|---|
| R15 | Allocation Performance | Quota đã cấp vs đã bán vs còn lại per Campaign | Excel |

---

## 3. Report Builder (Tự Tạo Báo Cáo — No-code)

Giao diện kéo thả cho người không biết IT:

**Bước 1 — Chọn Nguồn Dữ Liệu (Data Source):**
- Tồn Kho, Đơn Bán, Đơn Mua, Công Nợ, Khách Hàng, Hàng Hóa...

**Bước 2 — Chọn Chiều (Dimensions) & Chỉ Số (Metrics):**
- Dimensions: SKU, Tháng, Kênh, Sales Rep, NCC, Kho, Vintage...
- Metrics: Doanh số, Số lượng, Giá vốn, Margin, Số ngày tồn...

**Bước 3 — Bộ Lọc (Filters):**
- Chọn khoảng thời gian (Date Range Picker)
- Lọc theo Kênh, theo Kho, theo Sales Rep cụ thể...

**Bước 4 — Chọn Dạng Hiển Thị:**
- Table (Bảng số liệu)
- Bar Chart / Line Chart / Pie Chart
- Pivot Table

**Bước 5 — Lưu & Tái Sử Dụng:**
- Lưu lại Report Template với tên tùy ý
- Share với người khác trong team

---

## 4. Scheduled Reports (Báo Cáo Tự Động)

Admin cấu hình gửi email báo cáo tự động:

| Tần suất | Báo cáo gửi đi | Người nhận |
|---|---|---|
| **Hàng ngày 8:00** | Tồn kho cuối ngày (thay đổi so với hôm qua) | Quản lý Kho |
| **Thứ Hai 8:00** | Tổng kết doanh số tuần, AR quá hạn mới | CEO, Sales Manager |
| **Đầu tháng (ngày 2)** | Báo cáo tháng: Doanh thu, Margin, AR Aging | CEO, Kế toán |
| **Tùy chỉnh** | Admin tự cấu hình bất kỳ report + lịch + người nhận | — |

**Format gửi:** Excel đính kèm trong email + Link xem trực tiếp trên web

---

## 5. Export Standards

Mọi báo cáo trong hệ thống đều hỗ trợ:
- **Export Excel (.xlsx):** Giữ nguyên định dạng số, ngày tháng đúng chuẩn kế toán Việt Nam
- **Export PDF:** Cho báo cáo cần đóng dấu / lưu trữ chính thức
- **Export CSV:** Cho việc import vào phần mềm khác
- **Print Preview:** Tối ưu cho in giấy A4

**Excel chuẩn hóa:**
- Số tiền: Format VND (`#,##0`) hoặc ngoại tệ
- Ngày tháng: Format DD/MM/YYYY (chuẩn Việt Nam)
- Tiêu đề cột bằng Tiếng Việt
- Header có tên công ty, kỳ báo cáo, ngày xuất

---

## 6. Phân Quyền Báo Cáo

| Vai trò | Quyền xem |
|---|---|
| CEO | Mọi báo cáo, kể cả Margin thực, Giá vốn |
| Kế toán | Tất cả báo cáo tài chính, thuế |
| Sales Manager | Doanh thu, AR Aging, Allocation — Không thấy Giá vốn chi tiết |
| Sales Rep | Chỉ xem doanh số của chính mình |
| Quản lý Kho | Báo cáo tồn kho, hàng về |
| Thu mua | Báo cáo PO, Landed Cost, Thuế |

---

## 7. Database Design

```
ReportTemplate { id, name, created_by, source_module, dimensions, metrics, filters, chart_type, is_shared }
ReportSchedule { template_id, frequency, run_at, recipients[], last_run, status }
ReportRun { schedule_id, run_at, status, output_url }
```

*(Dữ liệu thực tế được query trực tiếp từ các bảng domain của từng module, không lưu trữ riêng để tránh data stale)*

---

## 8. Kiến Trúc Song Ngữ (Bilingual Architecture VI / EN)

Phân hệ Báo cáo & Điều hành BI Quản trị được trang bị giải pháp song ngữ toàn diện tại `src/app/dashboard/reports/i18n.ts` và tích hợp `useAppLocale()`:

### 1. Đồng Bộ 16 Báo Cáo Chuẩn (R01 — R16)

| Mã | Tên Tiếng Việt | English Name | Module Domain |
|:---:|---|---|:---:|
| **R01** | Tồn Kho Chi Tiết | Detailed Inventory Stock | WMS |
| **R02** | Doanh Thu Bán Hàng | Sales Revenue Breakdown | SLS |
| **R03** | Công Nợ Phải Thu (AR Aging) | Accounts Receivable Aging (AR) | FIN |
| **R04** | Phân Tích Giá Vốn & Biên LN | COGS & Gross Margin Analysis | CST |
| **R05** | Công Nợ Phải Trả (AP) | Accounts Payable Outstanding (AP) | FIN |
| **R06** | Tình Trạng Đơn Mua Hàng | Purchase Order (PO) Status | PRC |
| **R07** | Kết Quả Kinh Doanh Tháng | Monthly P&L Statement | FIN |
| **R08** | Biên Lợi Nhuận Theo SKU | Profit Margin per SKU | SLS |
| **R09** | Hiệu Suất Kênh Bán | Channel Performance Analytics | SLS |
| **R10** | Xếp Hạng Khách Hàng | Customer Revenue Ranking | CRM |
| **R11** | Hàng Tồn Chậm Luân Chuyển | Slow-Moving Inventory Stock | WMS |
| **R12** | Sử Dụng Tem Rượu | Excise Wine Stamp Utilization | STM |
| **R13** | Tổng Hợp Thuế NK/TTĐB/VAT | Import & Excise & VAT Summary | TAX |
| **R14** | Tổng Hợp Chi Phí | Operating Expenses Summary | FIN |
| **R15** | Sổ Nhật Ký Kế Toán | General Journal & Ledger | FIN |
| **R16** | Doanh Thu Theo Brand | Revenue by Wine Brand | SLS |

### 2. Trải Nghiệm Giao Diện 3 Tabs Bản Địa Hóa
1. **Executive BI Overview (`overview`):**
   - KPI cards (Doanh thu 6 tháng, Giá trị tồn kho, Tổng lượng chai, SKU đang có hàng).
   - Thống kê công nợ AR/AP đối soát song song.
   - Biểu đồ doanh thu 6 tháng gần nhất kèm tooltip chi tiết.
   - Cơ cấu kênh bán phân loại chuẩn quốc tế: `HORECA`, `Wholesale / Distributor`, `VIP Retail`, `Direct / Retail`.
   - Top 10 SKU bán chạy kèm phân loại vang: Red, White, Rosé, Sparkling, Fortified, Dessert.
   - Phân rã doanh thu theo Brand, xếp hạng Top 5 Khách hàng, Top Sales Rep và Cảnh báo tồn kho thấp.
2. **Xuất Excel 16 Báo Cáo (`export`):**
   - Bảng kê 16 báo cáo chuẩn hóa, hiển thị mã, tên báo cáo theo ngôn ngữ đã chọn, module phụ trách và trạng thái tải file.
3. **Lịch Báo Cáo Tự Động (`schedule`):**
   - Giám sát tiến độ cron job gửi email, tần suất Hàng ngày / Hàng tuần / Hàng tháng (Daily / Weekly / Monthly).
