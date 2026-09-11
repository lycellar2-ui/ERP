# Sales Field Visit (SFV) — Wine ERP Module Spec

> **Route:** `/dashboard/sales/visits`
> **Tiêu đề trang & Menu:** Quản Lý Check-in Thị Trường
> **Mã module:** SFV
> **Cập nhật ngày:** 2026-09-11 (Tách biệt hoàn toàn giao diện Quản Lý xem Báo Cáo Chung vs Sales Thực Địa, đổi tên tiêu đề chuẩn)

---

## Mô Tả

Module **Quản Lý Check-in Thị Trường** (Sales Field Operations) được kiến trúc phân định rạch ròi theo 2 vai trò người dùng:

1. **Dành cho Nhân viên Sales (Tài khoản nào biết tài khoản đó):**
   - Không có dropdown chọn nhân viên khác, bảo mật và cô lập dữ liệu tuyệt đối.
   - Quy trình khép kín 4 tab: Check-in hôm nay, Kế hoạch tuần, Tổng kết tuần, Lịch sử ảnh.
   - Giao diện di động tối ưu hoá 1 chạm với thanh điều hướng cố định đáy 4 nút, nút gọi điện, nút mở Google Maps chỉ đường.
2. **Dành cho Quản lý / CEO / Ban Giám Đốc (Không phải check-in, xem Báo Cáo Chung):**
   - Quản lý không đi thị trường nên không có các tab check-in thực địa.
   - Giao diện mở trực tiếp **Bảng Giám Sát & Báo Cáo Chung (Executive Board)**:
     - 5 Thẻ KPI đo lường toàn đội ngũ: Số nhân sự, Tổng kế hoạch, Đã check-in thực tế, Tỷ lệ hoàn thành %, Số báo cáo chờ duyệt.
     - Bộ điều hướng chọn tuần và nút làm mới tức thời.
     - Bảng ma trận đối soát Kế hoạch vs Thực tế từng nhân viên.
     - Modal thẩm định chuyên sâu: Soi ảnh check-in thực tế kèm GPS/watermark to rõ, kiểm tra kế hoạch tuần và phê duyệt đánh giá KPI.

## Tính Năng Chính

### 1. Phân Tách Vai Trò Người Dùng Tuyệt Đối
- **Tài khoản Sale ("Tài khoản nào biết tài khoản đó"):**
  - Cố định `selectedSalespersonId = currentUserId`, loại bỏ hoàn toàn ô chọn nhân viên trên giao diện.
  - Server Actions backend (`actions.ts`) ép buộc `where.salespersonId = user.id` nếu không phải Manager.
  - Hiển thị 4 tab tác nghiệp: Check-in hôm nay, Lịch tuần, Tổng kết tuần, Hình ảnh.
- **Tài khoản Quản lý / CEO / BGĐ (`isManager === true`):**
  - Không phải check-in, ẩn hoàn toàn các tab check-in thực địa và thanh bottom bar mobile.
  - Chuyển thẳng vào màn hình **Báo Cáo Giám Sát Toàn Đội** với đầy đủ số liệu KPI tổng hợp và bảng ma trận nhân viên.
- **Chuẩn hoá tiêu đề hiển thị:**
  - Tiêu đề thanh điều hướng Header ERP: `Quản Lý Check-in Thị Trường` (sửa lỗi hiển thị nhầm "Đơn Bán Hàng").
  - Mục menu Sidebar: `Quản Lý Check-in Thị Trường`.

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
