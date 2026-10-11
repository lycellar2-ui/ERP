# Kế Hoạch Hoàn Thiện Tính Năng Báo Giá Trực Tuyến (Public Quotation)

## Mục Tiêu
Đảm bảo tính năng tạo báo giá sinh ra đường dẫn web công khai (`/verify/quotation/[token]`) cho phép khách hàng không cần đăng nhập vẫn xem được đầy đủ, chuyên nghiệp, có thể in/tải PDF và phản hồi; đồng thời cho phép nhân sự nội bộ xem trước mà không bị chuyển hướng.

## Các Hạng Mục Thực Hiện

### 1. Sửa Middleware (`wine-erp/src/middleware.ts`)
- Tách riêng `authOnlyPaths = ['/login', '/forgot-password', '/reset-password']` khỏi `publicPaths = [...authOnlyPaths, '/verify']`.
- Chỉ chuyển hướng người dùng đã đăng nhập về `/dashboard` khi truy cập `authOnlyPaths`. Giữ nguyên quyền truy cập `/verify/**` cho cả khách lẫn người đã đăng nhập.
- Thêm `/api/export/quotation-pdf` vào danh sách `isPublicApi` để khách chưa đăng nhập không bị lỗi 401 khi tải PDF.

### 2. Nâng cấp API PDF (`wine-erp/src/app/api/export/quotation-pdf/route.ts`)
- Bổ sung hỗ trợ truy vấn báo giá bằng tham số `?token=...` (public token) bên cạnh `?id=...`.
- Đảm bảo khách xem web có thể tải/in PDF chuẩn hóa trực tiếp từ token công khai.

### 3. Đồng Bộ Trạng Thái & Cache (`wine-erp/src/app/verify/quotation/[token]/actions.ts`)
- Thêm `revalidateCache('quotations')` và `revalidatePath('/dashboard/quotations')` vào các action `acceptQuotationPublic` và `rejectQuotationPublic` để màn hình ERP phản ánh ngay khi khách chấp nhận/từ chối.

### 4. Nâng Cấp Giao Diện Web Khách Xem (`wine-erp/src/app/verify/quotation/[token]/QuotationPublicView.tsx`)
- Bổ sung nút **"In / Lưu PDF"** (mở trực tiếp bản PDF chuẩn A4 có dấu/header công ty).
- Việt hóa và song ngữ các tiêu đề, thông tin báo giá, trạng thái duyệt để thân thiện với khách hàng.

### 5. Tối Ưu Thao Tác Sales Dashboard (`wine-erp/src/app/dashboard/quotations/QuotationClient.tsx`)
- Đảm bảo `getQuotationDetail` tự động sinh `publicToken` nếu báo giá cũ chưa có.
- Thêm nút xem trực tiếp Web Báo Giá (`ExternalLink`) trên từng dòng danh sách báo giá (Desktop & Mobile).
- Thêm nút "Mở Web Báo Giá" trong Drawer Chi tiết.
- Hiển thị thông báo kèm nút mở nhanh link web ngay sau khi tạo báo giá mới.

### 6. Cập Nhật Tài Liệu Dự Án
- Cập nhật `docs/bug-fix-lessons.md` ghi nhận bài học sửa lỗi middleware redirect & 401 public API.
