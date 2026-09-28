# Kế Hoạch Triển Khai: Kế Hoạch Cuộc Gọi & Báo Cáo Cuộc Gọi Telesales (Telesales Call Planner & Call Reporting)

## 1. Bối cảnh & Mục tiêu
- **Phân hệ**: CRM (Customer Relationship Management).
- **Đối tượng sử dụng**:
  - Telesales / Sales làm việc tại nhà hoặc văn phòng (Corporate & Retail).
  - Quản lý / Trưởng nhóm Sales / CEO (Giao danh sách gọi, giám sát kế hoạch & tỷ lệ thực hiện cuộc gọi).
- **Yêu cầu cốt lõi**:
  1. **Lập Kế hoạch cuộc gọi (Calling Plan / To-Call List)**: Hỗ trợ Phương án C (Quản lý phân bổ danh sách gọi xuống, hoặc Telesale tự thêm khách vào kế hoạch ngày).
  2. **Quy tắc Lead**: Không cần điền giá trị tiền cho Lead (chỉ cần tên, cty, SĐT, kênh, mục đích, ghi chú).
  3. **Nút Gọi Trên Điện Thoại (Click-to-Call)**: Nút `tel:...` 1-chạm tối ưu cho giao diện Mobile/Điện thoại.
  4. **Cơ chế Tracking & Tự động mở Báo cáo cuộc gọi**:
     - Bắt sự kiện quay lại web (`visibilitychange` / `window.focus`), đo thời lượng cuộc gọi.
     - Tự động mở Modal/Popup **"Báo Cáo Cuộc Gọi"** ngay khi vừa kết thúc cuộc gọi.
  5. **Báo cáo kiểm soát Quản lý**:
     - Bảng ma trận theo dõi tỷ lệ thực hiện kế hoạch gọi (% Đã gọi / Kế hoạch).
     - Xuất báo cáo kế hoạch & kết quả cuộc gọi ra Excel/CSV.

---

## 2. Kiến trúc Kỹ thuật

### A. Database Model (`prisma/schema.prisma`)
- Bổ sung Model `SalesCallPlan`:
  - `id`: CUID
  - `salespersonId`: FK `User` (Telesale phụ trách gọi)
  - `assignedById`: FK `User` (Người giao việc nếu có)
  - `planDate`: DateTime (Ngày thực hiện gọi)
  - `channel`: `SalesChannel` (CORPORATE, RETAIL)
  - `customerId`: FK `Customer` (Nullable - liên kết khách có mã)
  - `prospectName`: Tên khách hàng / người liên hệ
  - `prospectCompany`: Tên công ty (Corporate)
  - `phone`: Số điện thoại liên hệ
  - `callType`: Loại cuộc gọi (Chào hàng mới, Chăm sóc định kỳ, Mời tasting, Báo giá, Nhắc hẹn...)
  - `priority`: URGENT, HIGH, NORMAL, LOW
  - `status`: PENDING, COMPLETED, RESCHEDULED, CANCELLED, OVERDUE
  - `notes`: Ghi chú chuẩn bị trước khi gọi
  - `scheduledTime`: Khung giờ dự kiến (Sáng, Chiều, 09:30...)
  - `callLogId`: FK `SalesCallLog` (Liên kết nhật ký cuộc gọi thực tế khi hoàn thành)
  - `completedAt`: DateTime?
  - `createdAt`, `updatedAt`

### B. Server Actions (`src/app/dashboard/crm/actions.ts`)
- `getDailyCallPlanAction()`: Lấy danh sách kế hoạch gọi theo ngày & nhân viên, thống kê tổng số / đã gọi / chưa gọi / tỷ lệ hoàn thành.
- `createCallPlanItemAction()`: Telesale tự thêm khách vào kế hoạch ngày.
- `assignCallPlanBatchAction()`: Quản lý chọn danh sách khách gán cho 1 hoặc nhiều Telesale.
- `completeCallPlanWithReportAction()`: Ghi nhận báo cáo cuộc gọi: cập nhật trạng thái `COMPLETED` trong kế hoạch, tự động tạo `SalesCallLog` (và `CustomerActivity` nếu có mã khách).
- `exportCallPlanReportCSVAction()`: Xuất CSV báo cáo chi tiết kế hoạch & kết quả gọi.

### C. Giao diện Người dùng (`src/app/dashboard/crm/TelesalesProspectingPanel.tsx`)
- Tab con hoặc bộ chuyển đổi ngay đầu trang: **"📋 Kế Hoạch Gọi Hôm Nay (To-Call List)"** vs **"📊 Tổng Quan & Chỉ Tiêu"**.
- Thiết kế Mobile-first:
  - Thẻ khách hàng gọi to rõ, có nút **[📞 Gọi Ngay]** kích hoạt `tel:...`.
  - Chip trạng thái: Chưa gọi, Đã hoàn thành, Hẹn gọi lại, Quá hạn.
  - Bộ đếm tiến độ: `Đã gọi 12 / 20 khách (60%)`.
  - Cơ chế tự động lắng nghe `visibilitychange` để bật Popup Báo cáo cuộc gọi.
  - Modal Báo Cáo Cuộc Gọi: Chọn kết quả 1-chạm, ghi chú, thời lượng rời web, hẹn ngày gọi lại.
  - Phía Quản lý: Modal Phân bổ danh sách gọi + Nút Xuất báo cáo CSV.

---

## 3. Các bước triển khai & Docs Sync
1. Cập nhật `prisma/schema.prisma`, chạy `npx prisma db push`.
2. Đồng bộ tài liệu bắt buộc theo `GEMINI.md` Docs Sync Protocol:
   - `docs/architecture/database-schema.md`
   - `docs/README.md`
   - `docs/llms.txt`
   - `CODEBASE.md`
   - `docs/modules/crm.md`
3. Cập nhật `src/app/dashboard/crm/actions.ts` với các Server Actions mới.
4. Nâng cấp component `TelesalesProspectingPanel.tsx`.
5. Kiểm tra TypeScript `npx tsc --noEmit`.
