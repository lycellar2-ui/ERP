# Sales Field Visit (SFV) — Wine ERP Module Spec

> **Route:** `/dashboard/sales/visits`
> **Mã module:** SFV
> **Cập nhật ngày:** 2026-09-11 (Nâng cấp toàn diện chu trình 3 bước & sửa lỗi Camera/GPS)

---

## Mô Tả

Module Hành trình thị trường (Sales Field Operations) quản lý toàn bộ quy trình đi thị trường của nhân viên kinh doanh rượu theo chu trình khép kín 3 bước:
1. **Lập kế hoạch tuần (Weekly Planning)**: Phân bổ khách hàng theo từng ngày trong tuần, chọn khách cũ hoặc tạo nhanh khách tiềm năng mới, chuẩn hóa hoạt động.
2. **Thực thi thực địa (Daily Field Work & Check-in)**: Check-in theo kế hoạch hoặc đột xuất, chụp ảnh camera watermark (thời gian, tên sale, tên khách, toạ độ), định vị GPS tự động giải mã địa chỉ, bắt buộc ghi chú kết quả khi check-out.
3. **Tổng kết & Review tuần (Weekly Review & Audit)**: Đối soát tự động Kế hoạch vs Thực tế (Planned vs Actual), đo lường KPI tỷ lệ hoàn thành %, khách mới mở được, sale tự chốt báo cáo và quản lý nhận xét chỉ đạo.

## Tính Năng Chính

### 1. Kế Hoạch Tuần (Weekly Planning)
- **Điều hướng tuần:** Chọn tuần làm việc (Tuần này / Tuần trước / Tuần sau).
- **Phân bổ 7 ngày:** Thứ 2 ➔ Chủ Nhật, hiển thị số điểm lên lịch cho từng ngày.
- **Thêm điểm đến linh hoạt:**
  - Chọn **Khách hàng cũ** từ danh bạ ERP (Searchable combobox).
  - HOẶC **Tạo nhanh khách tiềm năng mới** (`quickCreateProspectCustomer`) ngay tại màn hình lập lịch.
  - Chọn **Hoạt động chuẩn hóa:** Chăm sóc định kỳ, Thử rượu (Wine tasting) & Mẫu mới, Kiểm tra tồn kho/trưng bày menu, Thu hồi công nợ, Đàm phán hợp đồng, Xử lý khiếu nại, Mục đích khác.
- **Bảo toàn dữ liệu:** Lưu kế hoạch tuần thông minh (`saveWeeklyPlanAction`), không xóa các lượt đã thực hiện hoặc đang tiến hành.

### 2. Check-in & Check-out Thực Địa (Daily Check-in)
- **Danh sách hôm nay:** Tự động lọc các điểm cần đi theo kế hoạch hôm nay.
- **Check-in 1 chạm:** Tự động gắn mã lịch trình `scheduleId`.
- **Check-in đột xuất (Unplanned):** Hỗ trợ sale ghé thăm khách ngoài kế hoạch, gắn nhãn `ĐỘT XUẤT`.
- **Camera thực địa & Nén ảnh:** Chụp live camera hoặc camera native của điện thoại, tự động nén tối đa 1280px (chất lượng 0.8, ~150KB-250KB), đóng dấu watermark chân thực (Tên điểm bán, Tên Sale, Ngày giờ, Toạ độ).
- **GPS 2-tier:** Lấy toạ độ phần cứng và giải mã địa chỉ (Reverse Geocoding) qua Server Action để tránh lỗi CORS / User-Agent.
- **Đồng hồ thực địa:** Đếm thời gian lưu lại điểm bán theo thời gian thực (phút).
- **Check-out bắt buộc:** Yêu cầu chụp ảnh hoàn thành và **bắt buộc ghi chú kết quả làm việc thực tế** (nội dung trao đổi, phản hồi của khách, đơn hàng dự kiến).

### 3. Tổng Kết & Review Tuần (Weekly Review)
- **KPI Metrics:**
  - Tổng điểm kế hoạch
  - Số điểm đã đi thực tế
  - Tỷ lệ hoàn thành % (Planned vs Actual)
  - Số khách mới mở được (`LEAD-`)
  - Thời gian trung bình ở mỗi điểm bán
- **Bảng đối soát chi tiết từng ngày:** So sánh trực diện từng điểm lên lịch vs điểm thực tế đã đến, cảnh báo điểm bỏ lỡ, đánh dấu điểm đột xuất.
- **Báo cáo tự đánh giá của Sale:** Sale viết tổng kết tuần và bấm "Chốt Báo Cáo Tuần" (`submitWeeklyReportAction`, trạng thái `SUBMITTED`).
- **Nhận xét của Quản lý:** Trưởng phòng/Admin xem báo cáo tuần của từng nhân viên và lưu nhận xét chỉ đạo (`saveManagerFeedbackAction`, trạng thái `APPROVED`).

### 4. Lịch Sử & Tra Cứu Hình Ảnh
- Bảng lịch sử đa cột: Mã Visit, Khách hàng, Ảnh check-in (hiển thị micro-thumbnail tối ưu), Giờ đến, Toạ độ Google Maps, Ghi chú kết quả.
- **Tối ưu Payload DB (>95%):** Ảnh check-in lưu dạng cặp `{ thumb, full }`. Các truy vấn danh sách (`getSalesVisits`, `getWeeklyPlanWithVisits`, `getTeamWeeklySalesOverview`) chỉ tải micro-thumbnail (~5-8KB) thay vì chuỗi ảnh lớn 200KB-500KB. Khi người dùng nhấp xem chi tiết/phóng to, Server Action `getSalesVisitFullPhoto()` mới tải ảnh gốc phân giải cao theo cơ chế on-demand.
- Modal phóng to ảnh gốc, hỗ trợ tải ảnh về máy.

### 5. 👑 Giám Sát Thị Trường Dành Cho Quản Lý & CEO (Executive Field Operations Board)
- **Phân quyền bảo mật (Role-gated):** Tab thứ 5 (`MANAGEMENT`) chỉ hiển thị độc quyền cho các tài khoản Quản lý / Ban Giám Đốc (`isManager === true`: `Admin`, `Sales Manager`, `CEO`, `Manager`, `Ban Giám Đốc`). Sale thông thường hoàn toàn không nhìn thấy tab này, tránh rác và lộ dữ liệu toàn đội.
- **Top KPI Đội ngũ:**
  - Quy mô đội ngũ Sales
  - Tổng kế hoạch điểm bán toàn đội trong tuần
  - Tổng số điểm đã check-in thực tế thành công kèm ảnh chụp
  - Tỷ lệ hoàn thành trung bình toàn công ty (%)
  - Số lượng báo cáo tuần đang chờ CEO/Quản lý phê duyệt
- **Ma trận Theo dõi Toàn Đội Ngũ (Team Matrix Table):**
  - Danh sách từng Sale với avatar, chức vụ, email.
  - Thống kê đối soát trực diện: Điểm Lên Lịch vs Thực Tế Check-in vs Đột Xuất.
  - Thanh tiến độ trực quan với màu sắc theo tỷ lệ % (Emerald khi đạt cao, Amber/Rose khi chậm).
  - Trạng thái báo cáo tuần: Đã nộp (Chờ duyệt) / Đã duyệt / Chưa nộp.
  - Nút bấm `Kiểm Tra Kế Hoạch & Soi Ảnh` mở cửa sổ thẩm định chi tiết.
- **Cửa Sổ Soi Xét Toàn Diện (Field Inspection Drill-down Modal):**
  - **Sub-tab 1: 📸 Soi Ảnh & Định Vị GPS:** Hiển thị lưới hình ảnh chụp thực địa của nhân viên (tải thumbnail nhẹ), nhấp phóng to xem chi tiết watermark (tên điểm bán, ngày giờ, toạ độ GPS nét to) tải ảnh HD on-demand, có link `Mở Google Maps` kiểm tra vị trí thực tế tại điểm bán.
  - **Sub-tab 2: 📅 Lịch Trình Tuần:** Bảng kê 7 ngày chi tiết của nhân sự, trạng thái từng điểm hẹn, mục đích đi khách.
  - **Sub-tab 3: ✍️ Phê Duyệt & Đánh Giá:** Đọc bản tự đánh giá của Sale, Quản lý/CEO nhập nhận xét chỉ đạo trực tiếp và ấn nút `Phê Duyệt Kế Hoạch Tuần & Lưu Đánh Giá`.

### 6. Khả Năng Vận Hành Ngoại Tuyến (Offline Drafts) & Cấp Quyền GPS
- **Offline Draft Queue (Chống mất sóng 4G ở hầm rượu):**
  - Khi sale tác nghiệp ở hầm rượu, tầng hầm nhà hàng bị mất kết nối Internet, hệ thống tự động bắt lỗi và lưu bản ghi check-in cùng ảnh chụp vào `localStorage` (`SALES_VISITS_OFFLINE_DRAFTS_V1`).
  - Thanh thông báo trạng thái ngoại tuyến hiển thị rõ số lượt check-in đang chờ đồng bộ kèm nút "Đồng bộ ngay".
  - Tự động bắt sự kiện `window.addEventListener('online')` để đẩy các bản ghi offline lên máy chủ ngay khi thiết bị có sóng 4G/Wifi trở lại mà không cần nhập lại.
- **Hướng Dẫn Cấp Quyền GPS 1-Chạm:**
  - Modal hướng dẫn trực quan chia tab riêng cho **iOS Safari** (Cài đặt -> Safari -> Vị trí -> Cho phép) và **Android Chrome** (Biểu tượng ổ khoá/Cài đặt trang web -> Quyền vị trí -> Cho phép).
  - Nút bấm "Xem hướng dẫn bật GPS" tích hợp trực tiếp trên thanh trạng thái định vị và ngay trên kính ngắm camera khi phát hiện thiết bị chưa cấp toạ độ.
- **Bảo Mật Server Actions (Auth Guard):**
  - Toàn bộ 10 Server Actions trong `actions.ts` được bảo vệ bằng `requireAuth()`.
  - Nghiêm cấm nhận `salespersonId` từ client mà không đối chiếu quyền hạn; chỉ cho phép người dùng thao tác trên dữ liệu của chính mình (hoặc quyền Quản lý đối với các tác vụ duyệt kế hoạch/xem tổng quan).

### 7. Giao Diện Ứng Dụng Di Động Chuyên Nghiệp (Mobile-First Native App Experience)
- **Fixed Bottom Navigation Bar (Thanh điều hướng cố định đáy):**
  - Cố định ở mép dưới điện thoại (`fixed bottom-0 z-40`), kính mờ `backdrop-blur-lg`, phân cách nhẹ chuẩn app di động (Grab/Shopee/Zalo).
  - 5 Tab tiện dụng: 📍 Hôm nay (kèm số điểm cần đi), 📅 Lịch tuần (kèm tổng điểm lên lịch), 📊 Tổng kết, 📸 Hình ảnh, 👑 Giám sát (dành cho Quản lý).
  - Tự động ẩn thanh tab trên đầu khi xem trên mobile (`md:hidden`), bổ sung khoảng đệm an toàn `pb-28 md:pb-16` chống che khuất nội dung.
- **Thẻ Khách Hàng Thực Địa Hôm Nay (Touch-Friendly Native Cards):**
  - Tích hợp nút 1-chạm **[🗺️ Chỉ đường Maps]** mở trực tiếp Google Maps App dẫn đường tới quán.
  - Tích hợp nút 1-chạm **[📞 Gọi điện]** (`tel:`) liên hệ nhanh với chủ quán / phụ trách mua hàng.
  - Nút bấm chính **`[📸 CHECK-IN & CHỤP 1 ẢNH]`** kích thước lớn tối thiểu 48px, hiệu ứng active scale mượt mà, tối ưu bấm bằng 1 ngón tay cái khi đứng trước điểm bán.
- **Thanh Chọn Ngày Ngang (Horizontal Date Strip T2 ➔ CN):**
  - Màn hình Kế hoạch tuần trên di động hiển thị thanh cuộn ngang 7 ngày với tên thứ, ngày tháng và số điểm đã lên lịch.
  - Chạm chọn ngày nào hiển thị ngay danh sách điểm đến của ngày đó bên dưới kèm nút **[+ Thêm Điểm]**, không phải cuộn trang dọc qua 7 khối bảng dài.

## Files

| File | Vai trò |
|---|---|
| `next.config.ts` | Cấu hình `Permissions-Policy: camera=(self), geolocation=(self)` cho phép trình duyệt sử dụng Camera và GPS |
| `actions.ts` | Server Actions được bảo vệ bởi `requireAuth()`: `reverseGeocodeAction()`, `quickCreateProspectCustomer()`, `checkInSalesVisit()`, `checkOutSalesVisit()`, `getWeeklyPlanWithVisits()`, `saveWeeklyPlanAction()`, `submitWeeklyReportAction()`, `saveManagerFeedbackAction()`, `getTeamWeeklySalesOverview()`, `getSalesVisitFullPhoto()` |
| `SalesVisitsClient.tsx` | Client component 5-tab: Check-in hôm nay, Kế hoạch tuần, Tổng kết tuần, Lịch sử ảnh, Tab 5 Giám Sát Thị Trường (CEO / Manager), tích hợp Offline Draft Queue và Modal hướng dẫn bật GPS |
| `LiveCameraModal.tsx` | Modal camera trực tiếp: nén ảnh tự động, tạo micro-thumbnail song song, watermark chân thực, cảnh báo GPS trong kính ngắm, hỗ trợ native camera fallback |
| `page.tsx` | Server component nạp dữ liệu session, phân quyền `isManager` và danh bạ |

## Prisma Models

- `WeeklyVisitPlan` — Bảng kế hoạch tuần: `salesRepId`, `weekNumber`, `year`, `status`, `note`, `selfReview`, `managerFeedback`, `submittedAt`, `reviewedAt`, `reviewedById`
- `SalesVisitSchedule` — Chi tiết từng điểm trong kế hoạch: `planId`, `customerId`, `visitDate`, `purpose`, `status`, `isUnplanned`, `salesVisitId`, `resultNotes`
- `SalesVisit` — Lượt viếng thăm thực tế: `visitNo`, `customerId`, `salespersonId`, `status`, `purpose`, `activityType`, `scheduleId`, `isUnplanned`, `checkInTime`/`checkOutTime`, `checkInPhoto`/`checkOutPhoto`, GPS coords, `durationMinutes`, `notes`

## Enums
- `VisitStatus` — IN_PROGRESS, COMPLETED, CANCELLED

## Ràng Buộc (Constraints)
- ❌ Không thể check-in nếu đang có lượt viếng thăm `IN_PROGRESS` (bắt buộc check-out điểm trước).
- ❌ Bắt buộc chụp ảnh camera khi check-in và check-out.
- ❌ Bắt buộc nhập kết quả làm việc thực tế (tối thiểu 5 ký tự) khi check-out.
- ❌ Phải lưu kế hoạch tuần trước khi chốt nộp báo cáo tuần.
