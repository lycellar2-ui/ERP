# Phân Hệ Quy Trình Doanh Nghiệp (SOP Knowledge Hub) & Thư Viện Biểu Mẫu

> **Mã phân hệ:** `SOP`  
> **Đường dẫn:** `/dashboard/sop`  
> **Quyền truy cập:** Toàn thể cán bộ nhân viên đã đăng nhập (All Authenticated Users)  
> **Quyền quản trị / Chỉnh sửa:** Admin, Ban Giám Đốc, Trưởng bộ phận  
> **Trạng thái:** ✅ Đã hoàn thành (Giai đoạn 1 & 2 — Hỗ trợ Dynamic Web Admin Editor)

---

## 1. Giới Thiệu Tổng Quan
Phân hệ **SOP Knowledge Hub** là trung tâm tổng hợp toàn bộ quy trình vận hành tiêu chuẩn (Standard Operating Procedures) và thư viện biểu mẫu chính thức của công ty trong hệ thống Wine ERP. Phân hệ được thiết kế với triết lý **"Zero Training / Self-Service"**, kết hợp cơ chế **Quản trị trực tiếp trên Web (Admin Live Editor)**:

Các tính năng nổi bật:
1. **Sơ đồ luồng trực quan (Visual Stepper Flowchart):** Từng bước thực hiện được mô tả tuần tự kèm vai trò thực hiện (Actor), hành động cụ thể, sản phẩm chứng từ đầu ra và các lưu ý rủi ro.
2. **Deep Links chuyển màn hình:** Tích hợp nút điều hướng trực tiếp sang màn hình làm việc tương ứng trong Wine ERP (Báo giá, Đơn bán hàng, Kho, Đề nghị thanh toán, v.v.).
3. **Thư viện 43 Biểu mẫu chuẩn (Forms Library):** Cho phép nhân viên tải về 1-click toàn bộ các mẫu file `.xlsx`, `.docx` chuẩn (Form 8.8-A, Form 6.1-B, Form 6.4-B Báo giá, Form 4.5-A Landed Cost...).
4. **Chỉnh sửa quy trình trực tiếp trên Web (Live SOP Editor):** Admin/Trưởng phòng có thể bấm nút "Sửa Quy Trình" để cập nhật nội dung, sửa SLA, thêm/bớt bước và tiêu chí kiểm tra ngay trên giao diện mà không cần can thiệp vào mã nguồn.
5. **Upload & Thay thế Biểu mẫu (Form Uploader):** Kéo thả file Excel/Word mới lên web để cập nhật hoặc thay thế biểu mẫu cũ ngay lập tức. Nhân viên tải về sẽ nhận được bản mới nhất ngay.
6. **Ma trận trách nhiệm RACI & Self-Audit Checklist:** Làm rõ người chịu trách nhiệm (R), phê duyệt (A), tư vấn (C), nhận tin (I) và thanh tiến độ hoàn thành các tiêu chí kiểm tra trước khi bàn giao.

---

## 2. Danh Sách Quy Trình Cốt Lõi Nạp Sẵn

| Mã SOP | Tên Quy Trình | Phòng Ban | Thời Lượng / SLA | Biểu Mẫu Đính Kèm | Màn Hình Liên Quan |
|---|---|---|---|---|---|
| `SOP 6.1` | Phát triển Khách hàng Mới (Onboarding) | Phòng Kinh Doanh | 24h duyệt cơ chế • 2 ngày HĐMB | Form 8.8-A, Form 6.1-B, Form 6.1-A | `/dashboard/customers`, `/dashboard/proposals` |
| `SOP 6.3` | Xử lý Đơn hàng Bán Lẻ & Bán Buôn (SO) | Phòng Kinh Doanh | 15 - 30 phút | Form 6.3-A, Form 5.6-A | `/dashboard/sales`, `/dashboard/warehouse` |
| `SOP 6.4` | Chính sách Giá, Chiết khấu & Check Margin | Phòng Kinh Doanh | 30 phút - 4 giờ | Form 6.4-B, Form 6.4-A, Form 6.4-C, Form 6.4-D | `/dashboard/quotations`, `/dashboard/margin` |
| `SOP 6.8` | Quản lý Hàng ký gửi HoReCa & Kiểm toán vỏ chai | Kinh Doanh & Kho | Kiểm kê ngày 25-30 hàng tháng | Form 5.4-A, Form 5.5-B | `/dashboard/consignment`, `/dashboard/sales` |
| `SOP 8.2` | Quản lý Công nợ Phải thu (AR) & Thu hồi nợ | Tài Chính - Kế Toán | Báo cáo ngày • Đối soát ngày 01-05 | Form 8.2-A, Form 8.2-B, Form 8.2-C | `/dashboard/finance`, `/dashboard/reconciliation` |
| `SOP 8.4` | Tính Giá vốn Thực tế (Landed Cost & COGS) | Tài Chính - Kế Toán | 48h sau khi thông quan | Form 4.5-A, Form 8.4-A | `/dashboard/costing`, `/dashboard/procurement` |
| `SOP 3.1` | Dự báo Nhu cầu & Mua hàng Quốc tế (PO) | Mua Hàng & XNK | 4 - 8 tuần (Lead time 60 ngày) | Form 3.1-A, Form 3.1-B, Form 3.2-A, Form 3.4-A | `/dashboard/procurement`, `/dashboard/shipments` |
| `SOP 5.1` | Kiểm nhận Nhập kho, Dán tem & Kho mát | Kho Vận | 2 - 4 giờ / Lô hàng | Form 5.1-A, Form 5.2-A, Form 5.3-A, Form 5.7-A | `/dashboard/warehouse`, `/dashboard/stamps` |

---

## 3. Kiến Trúc Kỹ Thuật & Tệp Mã Nguồn

| Đường dẫn tệp | Chức năng |
|---|---|
| `wine-erp/public/forms/` | Thư mục lưu trữ 43 file biểu mẫu thực tế của công ty (`.xlsx`, `.docx`) |
| `wine-erp/src/data/sops-store.json` | JSON store lưu trữ toàn bộ dữ liệu quy trình có thể cập nhật qua Server Actions |
| `wine-erp/src/data/forms-data.ts` | Meta index cho 43 file biểu mẫu chuẩn |
| `wine-erp/src/app/dashboard/sop/actions.ts` | Server Actions: `getSopsAction`, `saveSopAction`, `deleteSopAction`, `getOfficialFormsAction`, `uploadFormAction` |
| `wine-erp/src/app/dashboard/sop/page.tsx` | Server Component nạp dữ liệu SSR và bọc Suspense boundary |
| `wine-erp/src/app/dashboard/sop/loading.tsx` | Skeleton loading chống giật layout |
| `wine-erp/src/app/dashboard/sop/SopCatalogClient.tsx` | Client Component: Chuyển đổi xem SOP / Thư viện Biểu mẫu, tìm kiếm, lọc theo phòng ban |
| `wine-erp/src/app/dashboard/sop/SopDetailModal.tsx` | Modal xem chi tiết sơ đồ luồng, ma trận RACI, checklist, tải form mẫu và nút sửa quy trình |
| `wine-erp/src/app/dashboard/sop/SopEditModal.tsx` | Modal chỉnh sửa trực tiếp quy trình trên web |
| `wine-erp/src/app/dashboard/sop/SopFormUploadModal.tsx` | Modal kéo thả tải lên hoặc thay thế biểu mẫu mới trực tiếp trên web |
| `wine-erp/src/components/layout/Sidebar.tsx` | Mục điều hướng "Quy Trình Chuẩn (SOP)" trên thanh menu |
