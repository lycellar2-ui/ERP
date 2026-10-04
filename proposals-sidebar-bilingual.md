# 🌐 Kế Hoạch Triển Khai Song Ngữ (Bilingual VI/EN) Toàn Diện Phân Hệ Tờ Trình & Menu Sidebar

> **Mã Nhiệm Vụ:** `PROPOSALS-SIDEBAR-BILINGUAL-01`  
> **Chuyên gia thực hiện:** `frontend-specialist`  
> **Trạng thái:** Đã thông qua Socratic Gate & Thống nhất phạm vi với người dùng  

---

## 1. Quyết Định Nghiệp Vụ & Phạm Vi (Đã xác nhận)
1. **Xử lý tiêu đề động (Proposal Title):**
   - Giữ nguyên tiêu đề do người dùng nhập.
   - Nếu tiêu đề được nhập dưới dạng song ngữ `Tiêu đề tiếng Việt / English Title` (ngăn cách bằng ` / `):
     - Khi `locale === 'vi'`: Hiển thị tiếng Việt làm tiêu đề chính (đậm), tiếng Anh làm phụ đề mờ bên dưới.
     - Khi `locale === 'en'`: Hiển thị tiếng Anh làm tiêu đề chính (đậm), tiếng Việt làm phụ đề mờ bên dưới.
   - Nếu tiêu đề không có dấu ` / `, hiển thị nguyên bản.
2. **Phạm vi chuyển đổi (Full Scope):**
   - **Thanh Menu Sidebar bên trái (`Sidebar.tsx`):** Toàn bộ nhóm danh mục, tất cả các mục điều hướng và nút chức năng (Đăng xuất, Thu gọn).
   - **Bảng danh sách Tờ Trình (`ProposalsClient.tsx`):**
     - Tiêu đề màn hình & nút "+ Tạo Tờ Trình / + New Proposal".
     - 5 thẻ thống kê (Tổng / Total, Chờ Duyệt / Pending, Bản Nháp / Draft, Đã Duyệt / Approved, Từ Chối / Rejected).
     - Thanh lọc trạng thái, lọc loại tờ trình (Categories), lọc mức độ ưu tiên (Priority), ô tìm kiếm (Search).
     - 10 cột bảng dữ liệu và toàn bộ badge trạng thái / ưu tiên / loại tờ trình.
     - Nút hành động nhanh (Chi tiết / Detail, Trình / Submit, Duyệt / Approve...).
   - **Drawer Xem Chi Tiết Tờ Trình (`DetailDrawer`):**
     - Thông tin chung, người trình, ngày giờ, ma trận phê duyệt cấp 1-2-3, bảng chi tiết sản phẩm / cơ chế giá, lịch sử & thảo luận.
   - **Drawer Tạo Mới Tờ Trình (`CreateDrawer`):**
     - Tiêu đề, chọn loại tờ trình, thông tin khách hàng/nhà cung cấp, form nhập chi tiết, bảng cơ chế giá, các nút lưu nháp & trình phê duyệt.

---

## 2. Kế Hoạch Thực Hiện Kỹ Thuật

```
[src/lib/i18n.ts] (Core Locale Engine - Đã có sẵn)
       │
       ├─────────────────────────────────┬─────────────────────────────────┐
       ▼                                 ▼                                 ▼
[Sidebar.tsx]             [proposals/i18n.ts]            [proposals/constants.ts]
• Bilingual NAV_GROUPS    • proposals dictionary         • Localized status, priority,
• Bilingual Nav Items     • labels for list, detail,       and category labels
• Bilingual Logout/Footer   and create drawer
                                         │
                                         ▼
                             [ProposalsClient.tsx]
                             • List / KPI / Filters / Table
                             • DetailDrawer
                             • CreateDrawer
```

### Bước 1: Khởi tạo Bộ Từ Điển `src/app/dashboard/proposals/i18n.ts`
- Định nghĩa từ điển song ngữ chuẩn thuật ngữ doanh nghiệp cho phân hệ Proposals & Submissions.

### Bước 2: Nâng cấp `constants.ts` trong Proposals
- Hỗ trợ hàm lấy nhãn Category, Priority, Status linh hoạt theo `locale: AppLocale`.

### Bước 3: Nâng cấp Menu Sidebar (`Sidebar.tsx`)
- Tích hợp `useAppLocale()`.
- Chuyển ngữ toàn bộ tiêu đề nhóm, từng menu item, tooltip và nút đăng xuất.

### Bước 4: Nâng cấp `ProposalsClient.tsx`
- Tích hợp `useAppLocale()`.
- Áp dụng song ngữ cho Header, Stats, Tabs, Filters, Table, Badge, Title Splitting, DetailDrawer, và CreateDrawer.

### Bước 5: Kiểm tra TypeScript & Đảm bảo không có lỗi Build
- Kiểm tra tính tương thích và xác nhận không có regression.

### Bước 6: Đồng bộ Tài Liệu (`docs/modules/proposals-approval.md`)
- Cập nhật tài liệu phân hệ theo đúng Docs Sync Protocol P0.
