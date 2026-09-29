# Task Plan: Phân Quyền Check-in Tài Khoản Jeremie (CBO) & Cơ Chế Kiểm Soát Bởi CEO

## 1. Mục Tiêu
Thiết lập cơ chế phân quyền đặc biệt cho tài khoản của **Jeremie Courivault** (`jeremie.courivault@lyscellars.com` - CBO):
- **Bắt buộc Check-in thực địa**: Đưa tài khoản Jeremie vào luồng lập kế hoạch tuần (`WeeklyVisitPlan`), check-in viếng thăm khách hàng/điểm bán bằng Camera & GPS thực địa tại `/dashboard/sales/visits`.
- **Cơ chế kiểm soát duy nhất bởi CEO**: 
  - Chỉ riêng **CEO (admin@lyscellars.com / lyptc@lyscellars.com)** là cấp thẩm định và phê duyệt duy nhất đối với kế hoạch tuần và báo cáo tự đánh giá của Jeremie.
  - Các Manager khác (Sales Manager, Trợ lý...) bị chặn quyền duyệt kế hoạch của Jeremie.
  - Bản thân Jeremie không được tự duyệt kế hoạch của mình.
- **Giám sát trực quan trên CEO Executive Board**:
  - Jeremie xuất hiện trên Bảng Giám Sát Đội Ngũ của CEO với huy hiệu riêng `[CBO • Giám Sát Trực Tiếp]`.
  - Toàn bộ ảnh check-in thực tế kèm tọa độ GPS và báo cáo nhanh của Jeremie hiển thị trên Today's Live Field Feed của CEO.
- **Trải nghiệm giao diện thông minh cho Jeremie (Dual-Mode)**:
  - Khi Jeremie đăng nhập vào `/dashboard/sales/visits`: Mặc định ưu tiên hiển thị tab **Check-in Ngay** và **Kế Hoạch Tuần Cá Nhân** để phục vụ tác nghiệp đi thị trường.
  - Đồng thời bổ sung tab chuyển đổi **Giám Sát Đội Ngũ (Executive Board)** để Jeremie vẫn theo dõi được số liệu toàn đội với tư cách Giám đốc Kinh doanh (CBO).

## 2. Các Bước Thực Hiện
- [ ] **Bước 1**: Cập nhật Server Actions `wine-erp/src/app/dashboard/sales/visits/actions.ts`:
  - `getTeamWeeklySalesOverview`: Mở rộng điều kiện truy vấn nhân sự được giám sát để bao gồm vai trò `CBO` và tài khoản Jeremie (`jeremie.courivault@lyscellars.com`).
  - `saveManagerFeedbackAction`: Thêm ràng buộc bảo vệ cấp cao — nếu đối tượng được duyệt là Jeremie/CBO, chỉ cho phép tài khoản có vai trò `CEO` / Ban Giám Đốc thực hiện phê duyệt; cấm tự phê duyệt.
- [ ] **Bước 2**: Cập nhật Server Page `wine-erp/src/app/dashboard/sales/visits/page.tsx`:
  - Nhận diện vai trò đặc thù của Jeremie (`isJeremie` / `isCboOrExecutiveRep`) và CEO (`isCeoController`).
  - Đảm bảo tải đầy đủ danh sách khách hàng (`customers`), kế hoạch cá nhân (`initialPlan`), và lượt check-in cho Jeremie.
- [ ] **Bước 3**: Cập nhật Client Component `wine-erp/src/app/dashboard/sales/visits/SalesVisitsClient.tsx`:
  - Bổ sung tab/toggle "Giám Sát Đội Ngũ" cho CBO Jeremie bên cạnh 4 tab tác nghiệp cá nhân (Check-in, Lịch tuần, Tổng kết, Lịch sử).
  - Hiển thị nhãn nhận diện `[CBO]` trên bảng giám sát của CEO và cảnh báo quyền hạn phê duyệt đối với người xem không phải CEO.
- [ ] **Bước 4**: Kiểm tra Type safety & Lint (`npx tsc --noEmit` hoặc build check).
- [ ] **Bước 5**: Đồng bộ tài liệu dự án (`docs/modules/sales-field-visit.md`, `docs/README.md`, `docs/llms.txt`).
