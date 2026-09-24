# Task Plan: HR & Employee Document Management (Phân Hệ Nhân Sự & Giấy Tờ Nhân Viên)

## 1. Mục Tiêu
Xây dựng phân hệ quản lý thông tin nhân sự và giấy tờ hồ sơ nhân viên toàn diện (`/dashboard/hr`):
- Quản lý hồ sơ nhân viên đầy đủ (Định danh, Công tác, HĐLĐ, Tài chính, Thuế, BHXH, Sức khỏe).
- Kho giấy tờ số hóa (HĐLĐ scan, CCCD 2 mặt, Bằng cấp/Chứng chỉ, Giấy KSK) lưu trữ trên Supabase Storage `erp-files`.
- Tính năng liên kết tùy chọn giữa Hồ sơ nhân sự và Tài khoản đăng nhập ERP (thực hiện bởi Trợ Lý hoặc HCNS).
- Hệ thống cảnh báo thời hạn kép: Thẻ KPI cảnh báo trực quan trên giao diện + Bắn thông báo (Notification bell) tới Ban Giám Đốc/Trợ Lý khi hợp đồng hoặc giấy tờ hết hạn trong vòng 30 ngày.
- Phân quyền 3 cấp độ: BOD/Trợ Lý/HCNS (toàn quyền), Quản lý bộ phận (nhân sự trực thuộc), Nhân viên (hồ sơ cá nhân).

## 2. Các Bước Thực Hiện
- [ ] Bước 1: Bổ sung model `Employee` và `EmployeeDocument` trong `prisma/schema.prisma`.
- [ ] Bước 2: Thực thi `npx prisma db push` để cập nhật cơ sở dữ liệu Supabase và generate Prisma Client.
- [ ] Bước 3: Cập nhật `src/lib/session.ts` để bổ sung quyền `HRM:*` và hỗ trợ vai trò HCNS / Trợ Lý.
- [ ] Bước 4: Viết Server Actions `src/app/dashboard/hr/actions.ts` (CRUD nhân viên, upload giấy tờ, cảnh báo hạn, liên kết tài khoản).
- [ ] Bước 5: Xây dựng giao diện Frontend:
  - `src/app/dashboard/hr/page.tsx`: Server Component tải dữ liệu ban đầu.
  - `src/app/dashboard/hr/HrClient.tsx`: Client Component với bộ lọc, thẻ KPI, bảng nhân viên.
  - `src/app/dashboard/hr/EmployeeDetailDrawer.tsx`: Drawer xem chi tiết hồ sơ 4 tab, kho giấy tờ, liên kết tài khoản ERP.
  - `src/app/dashboard/hr/EmployeeFormModal.tsx`: Modal tạo mới / chỉnh sửa thông tin nhân viên.
  - `src/app/dashboard/hr/DocumentUploadModal.tsx`: Modal tải lên giấy tờ kèm ngày cấp/hết hạn.
- [ ] Bước 6: Thêm mục menu "Nhân Sự & Giấy Tờ" vào `src/components/layout/Sidebar.tsx`.
- [ ] Bước 7: Tạo script seed hồ sơ mẫu cho các nhân sự hiện tại và kích hoạt cảnh báo mẫu.
- [ ] Bước 8: Đồng bộ tài liệu dự án (`docs/modules/hr.md`, `docs/architecture/database-schema.md`, `docs/README.md`, `CODEBASE.md`, `docs/llms.txt`).
- [ ] Bước 9: Kiểm tra type safety với `npx tsc --noEmit`.
