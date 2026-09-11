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
- Bảng lịch sử đa cột: Mã Visit, Khách hàng, Ảnh check-in/check-out, Giờ đến/về, Thời lượng, Toạ độ Google Maps, Ghi chú kết quả.
- Modal phóng to ảnh gốc, hỗ trợ tải ảnh về máy.

## Files

| File | Vai trò |
|---|---|
| `next.config.ts` | Cấu hình `Permissions-Policy: camera=(self), geolocation=(self)` cho phép trình duyệt sử dụng Camera và GPS |
| `actions.ts` | `reverseGeocodeAction()`, `quickCreateProspectCustomer()`, `checkInSalesVisit()`, `checkOutSalesVisit()`, `getWeeklyPlanWithVisits()`, `saveWeeklyPlanAction()`, `submitWeeklyReportAction()`, `saveManagerFeedbackAction()` |
| `SalesVisitsClient.tsx` | Client component 4-tab hoàn chỉnh: Check-in hôm nay, Kế hoạch tuần, Tổng kết & Review tuần, Lịch sử |
| `LiveCameraModal.tsx` | Modal camera trực tiếp: nén ảnh tự động, watermark chân thực, hỗ trợ native camera fallback |
| `page.tsx` | Server component nạp dữ liệu session và danh bạ |

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
