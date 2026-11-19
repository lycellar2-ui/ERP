# Module: Video Guides (Hướng Dẫn Sử Dụng Theo Màn Hình)

- **Code:** `GDE`
- **Route:** `/dashboard/guides`
- **Sidebar Placement:** Chân Sidebar (phía trên cụm `Ngôn ngữ` / `Đăng Xuất`)
- **Storage:** Cloudflare R2 (`video-guides/{screenKey}/{timestamp}_{safeName}`)
- **Database Model:** `VideoGuide` (`video_guides`)

## Tính Năng Chính
1. **Chia theo từng màn hình ERP:**
   - Hỗ trợ 8 nhóm màn hình chuẩn (`overview`, `master-data`, `procurement`, `sales`, `crm`, `warehouse`, `finance`, `system`) và cho phép tạo tên màn hình tùy chỉnh.
   - Bộ lọc tìm kiếm nhanh theo tiêu đề, mô tả, tên màn hình.
2. **Xem video trực tiếp từ Cloudflare R2:**
   - Trình phát HTML5 `<video>` tích hợp ngay trên trang cùng danh sách phát theo màn hình.
   - Endpoint `/api/r2-file/[...path]` tự động redirect `302` sang Presigned GET URL (hoặc `R2_PUBLIC_DOMAIN`) cho file video và `Range` request, hỗ trợ tua/seek mượt mà không buffer qua server Next.js.
3. **Upload & Quản lý (Phân quyền Admin/CEO/BOD/Assistant):**
   - Upload trực tiếp từ trình duyệt lên Cloudflare R2 bằng Presigned PUT URL (`getVideoGuidePresignedUploadUrl`, tối đa 500MB, định dạng MP4/WebM/MOV/M4V/OGG) kèm thanh tiến trình % và tự động đọc thời lượng video.
   - Chỉnh sửa tiêu đề, mô tả, màn hình, thứ tự hiển thị, trạng thái ẩn/hiện và xóa đồng bộ trên R2 + PostgreSQL.
