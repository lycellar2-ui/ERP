# Plan: Quản Lý Tasting Note & Hình Ảnh Rượu Trên Cloudflare R2

## Mục Tiêu
1. Hợp nhất lưu trữ toàn bộ hình ảnh sản phẩm (Product Media) và tài liệu Tasting Note lên Cloudflare R2.
2. Cập nhật màn hình Quản lý Sản phẩm (`/dashboard/products`): Cho phép upload trực tiếp file Tasting Note (PDF/Docx/Ảnh) và hình ảnh chai rượu lên Cloudflare R2 từ `ProductDrawer`.
3. Tự động hóa Bulk Import: Đẩy toàn bộ 110 file PDF Tasting Note từ `D:\Lyscellar\Learning and Development\TASTING NOTES` lên Cloudflare R2, gắn link vào `product.tastingNoteUrl` và bóc tách thông tin rượu vào `ProductProfile`.

## Các Bước Thực Hiện

### [x] Bước 1: Mở rộng Cloudflare R2 Storage Adapter (`storage-r2.ts`)
- Viết hàm `uploadProductAsset(formData, folder)` hỗ trợ lưu trữ vào:
  - `products/images/`
  - `products/tasting-notes/`
  - `products/documents/`
- Viết API Route `/api/r2-file/[...path]` phân giải và phục vụ file có ký hoặc chuyển hướng CDN.

### [x] Bước 2: Nâng cấp Server Actions (`dashboard/products/actions.ts`)
- Thay thế `uploadFileToImgBB` trong `uploadProductMedia` và `uploadProductImage` bằng Cloudflare R2.
- Bổ sung `uploadProductTastingNote(productId, formData)` và `deleteProductTastingNote(productId)`.
- Đảm bảo revalidate cache và audit trail.

### [x] Bước 3: Cập nhật Giao diện Quản lý Sản phẩm
- `ProductDrawer.tsx`:
  - Thêm khu vực Upload File Tasting Note (PDF, DOCX, ảnh) trực tiếp lên R2. Hiển thị trạng thái file, nút tải về/xem trước và nút xoá file.
  - Chuyển bộ upload ảnh chai rượu sang Cloudflare R2 thay cho ImgBB.
- `ProductDetailDrawer.tsx`:
  - Nâng cấp hiển thị Tasting Note: badge định dạng file, nút xem trực tiếp và nút tải về máy nhanh chóng.

### [x] Bước 4: Chạy Script Bulk Import 215 File Tasting Note Lên Cloudflare R2
- Tạo và chạy `wine-erp/scripts/bulk_import_tasting_notes_r2.ts`.
- Đọc các file PDF từ kho lưu trữ `D:\Lyscellar\Learning and Development\TASTING NOTES`.
- Upload thành công 215 file PDF lên Cloudflare R2 `products/tasting-notes/`.
- Parse nội dung text từ PDF và update `tastingNoteUrl` + `ProductProfile` (aromas, palate, food pairings, grapes) vào database.

### [x] Bước 5: Kiểm Tra & Đồng Bộ Tài Liệu
- Kiểm tra tính toàn vẹn dữ liệu và build TypeScript (`npx tsc --noEmit` pass 100%).
- Cập nhật tài liệu kỹ thuật theo Docs Sync Protocol (`docs/modules/master-data.md`, `CODEBASE.md`).
