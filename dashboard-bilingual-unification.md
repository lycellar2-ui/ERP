# 🌐 Kế Hoạch Triển Khai Song Ngữ (Bilingual VI/EN) Dashboard Điều Hành & Phân Hệ ERP

> **Mã Nhiệm Vụ:** `DASH-BILINGUAL-01`  
> **Chuyên gia thực hiện:** `frontend-specialist` + `backend-specialist`  
> **Trạng thái:** Sẵn sàng thực thi (Đã thông qua Socratic Gate)  

---

## 1. Mục Tiêu & Yêu Cầu Cốt Lõi

1. **Tính Nhất Quán Giữa Các Phân Hệ (Cross-Module Consistency):**
   - Không tạo các cơ chế lưu trữ rời rạc. Hệ thống chuẩn hóa dùng chung `erp_locale` trong `localStorage` và duy trì tương thích 100% với `sales_visits_locale` (phân hệ Field Check-in).
   - Khi người dùng (CEO, CBO Jeremie Courivault, Kế toán, Sales) chuyển ngôn ngữ ở Header hoặc thanh lọc Dashboard, toàn bộ hệ thống lắng nghe sự kiện (`erp_locale_change`, `sales_visits_locale_change`) và đồng bộ tức thời không cần reload trang.

2. **Phạm Vi Dịch Thuật Toàn Diện (100% Comprehensive Coverage):**
   - **Thanh điều hướng Header (`Header.tsx`):** Nút chuyển đổi VI / EN nổi bật, tinh tế; tiêu đề trang chuyển đổi linh hoạt.
   - **Thanh lọc kỳ & pháp nhân (`DashboardFilterBar.tsx`):** Toàn bộ nhãn presets (Hôm nay / Today, Tháng này / This month, ...), chọn pháp nhân (Tất cả / All Entities), khoảng ngày tùy chọn.
   - **6 Thẻ KPI Điều Hành:** Doanh thu thuần, Lãi gộp, Dòng tiền ròng, Tồn kho, Nợ phải thu AR, Chờ duyệt.
   - **Biểu Đồ Doanh Thu Ngày (`DailyRevenueChart.tsx`):** Doanh thu theo từng ngày, đỉnh kỳ, giá trị trung bình đơn, ngày cao điểm.
   - **Khối Kết Quả Kinh Doanh (P&L):** Báo cáo kết quả kinh doanh, doanh thu thuần, giá vốn hàng bán, lợi nhuận gộp, chi phí hoạt động, lợi nhuận ròng.
   - **Khối Dòng Tiền & Cân Đối Thu - Chi:** Dòng tiền ròng, dòng tiền vào, thu nợ AR, dòng tiền ra, trả nhà cung cấp AP, chi phí vận hành.
   - **Khối Thác Đổ Cấu Trúc Chi Phí (Cost & Margin Waterfall):** Giá vốn hàng bán, chi phí bán hàng, chi phí quản lý doanh nghiệp, lãi ròng.
   - **Khối Phân Tích Tuổi Nợ (AR Aging Analysis):** Chưa đến hạn, 1-30 ngày, 31-60 ngày, 61-90 ngày, >90 ngày, nợ quá hạn.
   - **Khối Top Bán Hàng & Cơ Cấu Kênh:** Top khách hàng, top sản phẩm, phân tích tỷ trọng kênh phân phối (Wholesale, Horeca, Retail, Private...).
   - **Tab Phân Tích Khách Hàng 360° (`CustomerAnalyticsDashboard.tsx`):** Tìm kiếm khách hàng, lịch sử mua hàng, cơ chế giá riêng, bảng giá đặc biệt, trạng thái đơn hàng.

---

## 2. Kế Hoạch Triển Khai Kỹ Thuật

```
[src/lib/i18n.ts] (Core Locale Engine - Centralized)
       │
       ├─────────────────────────┬─────────────────────────┐
       ▼                         ▼                         ▼
[Header.tsx]             [Dashboard / CEO]        [Customer 360]
• System-wide VI/EN      • CeoOverviewContent     • Search & Metrics
• Dynamic page title     • DashboardFilterBar     • Order History
                         • DailyRevenueChart      • Price Mechanisms
                         • P&L, Cash, AR, Costs   • Status Badges
```

### Bước 1: Khởi tạo Bộ Điều Khiển Ngôn Ngữ Trung Tâm (`src/lib/i18n.ts`)
- Định nghĩa type `AppLocale = 'vi' | 'en'`.
- Hỗ trợ `getAppLocale()`, `setAppLocale()`, `useAppLocale()`.
- Đồng bộ 2 chiều với `sales_visits_locale` và dispatch song song 2 CustomEvents.

### Bước 2: Xây Dựng Từ Điển Thuật Ngữ Dashboard (`src/app/dashboard/i18n.ts`)
- Chuẩn hóa từ điển song ngữ chuẩn ngành rượu vang & quản trị tài chính doanh nghiệp:
  - Tránh dịch máy ngây ngô, sử dụng thuật ngữ kế toán - thương mại quốc tế (COGS, Gross Profit, Operating Expenses, Net Cash Flow, Accounts Receivable, Overdue Debt, Special Price Rule).

### Bước 3: Nâng Cấp Header Toàn Hệ Thống (`src/components/layout/Header.tsx`)
- Hiển thị nút chuyển đổi VI / EN khi đang ở Dashboard và các phân hệ song ngữ.
- Cập nhật tiêu đề Header linh hoạt theo `locale` ('Dashboard CEO' / 'Executive Dashboard').

### Bước 4: Tách & Nâng Cấp Client Component `CeoOverviewContent.tsx`
- Tách phần nội dung render của Dashboard CEO từ `page.tsx` thành Client Component có khả năng phản ứng ngay lập tức với thay đổi `locale`.
- Render song ngữ mượt mà cho 6 KPI cards, P&L, Cash Position, Waterfall, AR Aging, Top Lists.

### Bước 5: Cập Nhật `DashboardFilterBar.tsx` & `DailyRevenueChart.tsx`
- Nhúng `useAppLocale()` để dịch các presets lọc ngày, nút tùy chọn và các chỉ số biểu đồ.

### Bước 6: Cập Nhật Tab `CustomerAnalyticsDashboard.tsx`
- Chuyển đổi song ngữ toàn bộ giao diện lịch sử mua hàng, phân tích cơ chế giá, bảng giá đặc biệt, bộ lọc thời gian và nhãn trạng thái đơn hàng.

### Bước 7: Kiểm Thử Build & Xác Nhận Tính Đồng Bộ
- Chạy `npm run build` hoặc type check để đảm bảo không có lỗi TypeScript hay xung đột runtime.
- Kiểm tra sự kiện chuyển đổi qua lại giữa VI và EN.
