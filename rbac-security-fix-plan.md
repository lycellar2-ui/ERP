# Task Plan: Khắc Phục Toàn Diện Hệ Thống Phân Quyền (RBAC) & Bảo Mật Truy Cập

## Mục Tiêu (Goal)
Khắc phục triệt để các lỗ hổng Broken Access Control (OWASP A01), vá 6 route bị hở, chuẩn hóa logic kiểm tra vai trò tại Layout, thêm Auth Guard và kiểm tra quyền cấp duyệt trong các Server Actions nhạy cảm (Tài chính, Mua hàng, Bán hàng, Kho, Tờ trình), cập nhật Cache Invalidation, bổ sung Seed Permissions còn thiếu, và sửa menu Kế toán.

## Danh Sách Công Việc (Tasks)
- [x] Task 1: **Vá Route Guards trong `src/middleware.ts` & `src/app/dashboard/layout.tsx`**
  - Thêm 6 route nhạy cảm (`audit-log`, `hr`, `margin`, `payment-requests`, `proposals`, `shipments`) vào `ROUTE_PERMISSIONS`.
  - Cập nhật `layout.tsx` sử dụng `hasRole(user, 'CEO', 'ADMIN', 'TRO_LY')` và kiểm tra quyền linh hoạt thay vì check chuỗi cứng.
  - Verify: Sắp xếp matchers giảm dần theo độ dài; truy cập thử nghiệm với header permissions không bị bypass.
- [x] Task 2: **Vá Lỗ hổng Cấp duyệt trong Procurement (`procurement/actions.ts`) & Proposals (`proposals/actions.ts`)**
  - Kiểm tra `hasRole(user, currentStep.role)` hoặc CEO/Admin trong `approvePO`.
  - Trong `processProposalApproval`, loại bỏ việc nhận `approverId` tùy tiện từ client; xác thực trực tiếp qua `requireAuth()` và kiểm tra vai trò cấp duyệt tương ứng.
  - Verify: User không có vai trò phù hợp bị chặn với thông báo lỗi rõ ràng.
- [x] Task 3: **Vá Lỗ hổng Cấp duyệt trong Payment Requests (`payment-requests/actions.ts`)**
  - Thêm kiểm tra `isManager` ở cấp 1, `isAccountant` ở cấp 2, `isCEO` ở cấp 3 trong `processPaymentApprovalAction`.
  - Thêm `requireAuth()` cho các hàm thao tác đề nghị thanh toán.
  - Chống tự phê duyệt đề nghị do chính mình tạo ra.
  - Verify: Không thể tự duyệt hoặc duyệt nhảy cóc cấp thẩm quyền.
- [x] Task 4: **Vá Fallback Admin & Bảo Vệ Server Actions Tài Chính (`finance/actions.ts`)**
  - Loại bỏ hoàn toàn logic fallback tự động lấy user admin đầu tiên (`user?.id ?? admin.id`).
  - Thêm `requireAuth()` và phân quyền chi tiết cho các server actions thực thi giao dịch tài chính (thanh toán AR, AP, xóa nợ, tạo bút toán sổ cái, đóng kỳ kế toán, duyệt chi phí).
  - Verify: Lệnh không có session bị chặn bằng throw Error chuẩn.
- [x] Task 5: **Vá Lỗ hổng Quyền Hạn trong Báo Giá (`quotations/actions.ts`) & Cơ Hội (`pipeline/actions.ts`)**
  - Thêm `requireAuth()` và scoping theo người phụ trách (`salesRepId` / `assignedTo`) để bảo vệ dữ liệu thương mại của từng nhân viên kinh doanh.
  - Verify: Sales rep không thể xem hoặc sửa đè báo giá/cơ hội của rep khác nếu không phải Quản lý/CEO.
- [x] Task 6: **Vá Cache Invalidation & Bổ Sung Seed Permissions (`prisma/seed-rbac.ts`)**
  - Trong `updateRolePermissions` ([settings/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/settings/actions.ts)), gọi `invalidateUserSession()` để làm mới quyền ngay lập tức cho người dùng.
  - Bổ sung các module `HRM`, `PAY`, `PRO`, `SHP`, `POS` vào `seed-rbac.ts` để đồng bộ hoàn toàn với danh mục quyền thực tế của hệ thống.
  - Verify: Quyền hạn được xóa cache tức thì, không bị trễ 5 phút.
- [x] Task 7: **Sửa hiển thị Menu Kế Toán (`Sidebar.tsx`) & Bảo vệ các API Routes (`/api/ai/config`, `/api/ceo-summary`, `/api/import-lyscellars`)**
  - Bổ sung `'/dashboard/payment-requests'` vào `accountantAllowedHrefs` trong `Sidebar.tsx`.
  - Thêm kiểm tra quyền Admin vào `PUT /api/ai/config` và `POST /api/ceo-summary`.
  - Thêm kiểm tra quyền Admin hoặc MDM Write vào `POST /api/import-lyscellars`.
  - Verify: Kế toán thấy link Đề Nghị Thanh Toán; API routes từ chối request không có quyền.
- [x] Task 8: **Kiểm tra Type Safety & Build Check (`npx tsc --noEmit`)**
  - Verify: Dự án biên dịch sạch không có lỗi TypeScript (exit code 0).
- [x] Task 9: **Đồng bộ Tài liệu Dự án (Docs Sync Protocol — P0)**
  - Cập nhật `docs/bug-fix-lessons.md` (BUG-132, RULE 132).
  - Cập nhật `docs/modules/admin-auth-workflow.md`.
  - Cập nhật `docs/README.md` & `docs/llms.txt`.
  - Verify: Số lượng và quy tắc đồng bộ 100%.

## Hoàn Thành Khi (Done When)
- [x] Không còn route dashboard hay API route nào bị hở phân quyền.
- [x] Các luồng duyệt PO, SO, Payment Request, Tờ Trình bắt buộc đúng vai trò của từng bước.
- [x] Type check TypeScript pass 100%.
- [x] Tài liệu đồng bộ đầy đủ.
