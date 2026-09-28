# Kế Hoạch Triển Khai: Quản Lý Mục Tiêu Tìm Kiếm Khách Hàng & Nhật Ký Cuộc Gọi (Corporate & Retail CRM)

## 1. Bối cảnh & Mục tiêu
- **Phân hệ**: CRM (Customer Relationship Management).
- **Đối tượng người dùng**:
  - Đội ngũ Sales Corporate (B2B, Quà tặng doanh nghiệp, Hợp đồng tiệc & sự kiện công ty).
  - Đội ngũ Sales Retail (B2C, Khách hàng cá nhân VIP, Showroom, Đại lý nhỏ).
  - Quản lý / Trưởng phòng Kinh doanh / CEO (Giám sát chỉ tiêu, đo lường năng suất, audit cuộc gọi).
- **Yêu cầu cốt lõi**:
  1. Quản lý mục tiêu & kế hoạch tìm kiếm khách hàng mới (Prospecting / Lead Generation Targets theo Tuần/Tháng).
  2. Đo lường và kiểm soát số lượng cuộc gọi hàng ngày (Daily Call Quota & Tracking) theo từng kênh Corporate vs Retail.
  3. Ghi nhanh nhật ký cuộc gọi 1-chạm (Quick Call Logger) với phân loại kết quả chuẩn nghiệp vụ rượu vang.
  4. Bảng điều khiển CRM tập trung (Telesales & Prospecting Hub) hiển thị ma trận năng suất thời gian thực.

---

## 2. Kiến trúc Kỹ thuật

### A. Database Model (`prisma/schema.prisma`)
- Bổ sung Model `SalesCallLog`:
  - `id`: CUID
  - `salespersonId`: FK `User`
  - `channel`: `SalesChannel` (CORPORATE, RETAIL, HORECA...)
  - `customerId`: FK `Customer` (Nullable - cho phép gọi đầu mối mới chưa mở mã KH)
  - `prospectName`: Tên người liên hệ / khách hàng
  - `prospectCompany`: Tên công ty / doanh nghiệp (cho khách Corporate)
  - `phone`: Số điện thoại liên hệ
  - `callType`: Phân loại cuộc gọi (Chào hàng mới, Quà tặng doanh nghiệp, Hẹn tasting, Chăm sóc khách VIP, Theo dõi báo giá...)
  - `outcome`: Kết quả cuộc gọi (Quan tâm báo giá, Đã chốt hẹn gặp, Khách bận hẹn gọi lại, Không nghe máy, Sai số, Chốt đơn thành công)
  - `notes`: Ghi chú nội dung trao đổi
  - `followUpDate`: Ngày hẹn gọi lại hoặc hẹn gặp
  - `durationMinutes`: Thời lượng ước tính
  - `calledAt`: Thời gian cuộc gọi thực hiện
- Sử dụng Model `KpiTarget` có sẵn để lưu trữ định mức:
  - `CALLS_DAILY`: Định mức cuộc gọi tối thiểu/ngày (Mặc định: Retail 20-30 cuộc, Corporate 10-15 cuộc).
  - `NEW_LEADS`: Chỉ tiêu khách hàng mới tìm được trong tháng.
  - `DEALS_COUNT`: Chỉ tiêu cơ hội (Deals) tạo mới trong tháng.

### B. Server Actions (`src/app/dashboard/crm/actions.ts`)
- `getTelesalesProspectingDashboard()`: Nạp số liệu tổng quan, bảng chỉ số đội ngũ, feed cuộc gọi hôm nay.
- `logSalesCallAction()`: Ghi nhận nhật ký cuộc gọi mới và đồng bộ sang `CustomerActivity` nếu có liên kết khách hàng.
- `setSalesQuotaAction()`: Thiết lập định mức cuộc gọi ngày và chỉ tiêu tháng cho nhân viên.
- `convertProspectToCustomerAction()`: Chuyển đổi nhanh đầu mối tiềm năng thành khách hàng chính thức.

### C. Giao diện Người dùng (`src/app/dashboard/crm/TelesalesProspectingPanel.tsx`)
- Tab mới `calls` (Mục Tiêu & Cuộc Gọi) trong `CRMClient.tsx`.
- Giao diện Pure Light Design System:
  - Header & KPI Ribbon: Tổng cuộc gọi hôm nay, Tỷ lệ kết nối, Lead mới, Deal mới.
  - Bộ lọc kênh: `Tất cả` | `Corporate Sales` | `Retail Sales`.
  - Hộp ghi nhanh cuộc gọi (Quick Call Logger): Nhanh gọn 30s với chip 1-chạm.
  - Bảng tiến độ cuộc gọi hôm nay (Daily Call Leaderboard): Thanh tiến độ % so với chỉ tiêu ngày.
  - Bảng tin trực tiếp (Live Call Activity Feed): Lịch sử cuộc gọi theo thời gian thực.
  - Modal thiết lập KPI dành cho Quản lý.

---

## 3. Các bước thực hiện & Kiểm thử
1. Cập nhật `prisma/schema.prisma` và chạy `npx prisma db push`.
2. Đồng bộ tài liệu bắt buộc theo `GEMINI.md` Docs Sync Protocol (`database-schema.md`, `README.md`, `llms.txt`, `CODEBASE.md`).
3. Viết Server Actions trong `src/app/dashboard/crm/actions.ts`.
4. Xây dựng component `TelesalesProspectingPanel.tsx` và gắn vào `CRMClient.tsx`.
5. Chạy kiểm tra TypeScript `npx tsc --noEmit`.
6. Cập nhật `docs/modules/crm.md` với đầy đủ tài liệu tính năng mới.
