# 📸 Module Marketing — Wine ERP

> **Ngày tạo:** 2026-03-07
> **Trạng thái:** Phase 1 ✅ Đã triển khai (Media Library)
> **Route:** `/dashboard/media`
> **Sidebar:** Marketing > Thư Viện Ảnh

---

## Tổng Quan

Module Marketing phục vụ team Marketing & Sales trong việc quản lý tài sản hình ảnh, tạo nội dung bán hàng, và theo dõi chiến dịch. Triển khai theo phases.

---

## Phase 1: Media Library ✅ (Đã triển khai)

### Mô tả
Trang quản lý tập trung tất cả hình ảnh sản phẩm đã upload. Hỗ trợ xem, tìm kiếm, lọc, upload mới, xóa đơn/hàng loạt.

### Files

| File | Mô tả |
|------|-------|
| `src/app/dashboard/media/page.tsx` | Server page — fetch data |
| `src/app/dashboard/media/MediaClient.tsx` | Client component — UI chính |
| `src/app/dashboard/media/actions.ts` | Server actions (CRUD, stats) |
| `src/app/dashboard/media/loading.tsx` | Loading skeleton |
| `src/lib/imgbb.ts` | ImgBB upload service |
| `src/components/ImageUploader.tsx` | Reusable single-image uploader |
| `src/components/DocumentUploader.tsx` | Reusable document uploader |

### Tính năng đã triển khai

| # | Tính năng | Trạng thái |
|---|-----------|:----------:|
| 1 | Grid gallery responsive (2-6 cột) | ✅ |
| 2 | Search theo tên SP / SKU | ✅ |
| 3 | Filter theo loại ảnh (MediaType enum) | ✅ |
| 4 | Pagination (24 ảnh/trang) | ✅ |
| 5 | Stats cards (tổng ảnh, SP có/chưa có ảnh) | ✅ |
| 6 | Upload modal (chọn SP + loại ảnh, multi-file) | ✅ |
| 7 | Lightbox xem ảnh lớn | ✅ |
| 8 | Select / Bulk delete | ✅ |
| 9 | Badge: ảnh chính (⭐), loại ảnh (emoji) | ✅ |
| 10 | Hover overlay: tên SP, SKU, actions | ✅ |

### Server Actions

```typescript
// actions.ts exports:
getAllMedia(filters)          // Lấy danh sách ảnh + pagination
getMediaStats()              // Thống kê tổng quan
uploadMediaToProduct(id, fd) // Upload ảnh mới cho SP
deleteMedia(id)              // Xóa 1 ảnh
bulkDeleteMedia(ids)         // Xóa nhiều ảnh
getProductsForUpload()       // Danh sách SP cho dropdown
```

### MediaType Enum (Prisma Schema)

| Value | Label | Emoji | Mô tả |
|-------|-------|:-----:|--------|
| `PRODUCT_MAIN` | Ảnh chính | 🍷 | Ảnh hiển thị chính của SP |
| `LABEL_FRONT` | Nhãn trước | 🏷️ | Ảnh nhãn mác mặt trước |
| `LABEL_BACK` | Nhãn sau | 🔖 | Ảnh nhãn mác mặt sau |
| `LIFESTYLE` | Lifestyle | 📸 | Ảnh chụp phong cách sống |
| `BOTTLE_GROUP` | Nhóm chai | 🍾 | Ảnh nhóm nhiều chai |
| `CASE_OWC` | Hộp gỗ | 📦 | Ảnh hộp gỗ OWC |
| `AWARD_CERTIFICATE` | Chứng nhận | 🏆 | Ảnh giải thưởng/chứng nhận |
| `PRODUCER_WINERY` | Nhà máy | 🏰 | Ảnh nhà sản xuất |

### Image Storage: ImgBB

| Thông tin | Giá trị |
|-----------|---------|
| **Service** | ImgBB (https://api.imgbb.com/) |
| **Env key** | `IMGBB_API_KEY` |
| **Max file** | 10MB (app limit) / 32MB (ImgBB limit) |
| **Formats** | JPEG, PNG, WebP |
| **URLs stored** | `url`, `thumbnailUrl`, `mediumUrl` |
| **DB Model** | `ProductMedia` (1-nhiều với Product) |

---

## Phase 2: Product Card Generator (Chưa triển khai)

### Ý tưởng
Tạo card sản phẩm đẹp (ảnh + thông tin + giá) xuất ra PNG/PDF để gửi khách hàng, đại lý.

### Tính năng dự kiến
- [ ] Template card sản phẩm (nhiều layout)
- [ ] Tự động fill data từ DB (tên, giá, ABV, vintage, giải thưởng)
- [ ] Chọn ảnh từ Media Library
- [ ] Xuất PNG / PDF
- [ ] Batch export nhiều SP cùng lúc

---

## Phase 3: Catalog / Lookbook (Chưa triển khai)

### Ý tưởng
Tạo catalogue SP theo bộ sưu tập để gửi cho đại lý, nhà hàng.

### Tính năng dự kiến
- [ ] Tạo collection (nhóm SP theo chủ đề)
- [ ] Template catalogue (cover + pages)
- [ ] Xuất PDF catalogue
- [ ] Chia sẻ qua link/email

---

## Phase 4: Campaign & Social Content (Chưa triển khai)

### Ý tưởng
Quản lý chiến dịch marketing + tạo nội dung social media từ data SP.

### Tính năng dự kiến
- [ ] Campaign tracker (tên, timeline, budget, kết quả)
- [ ] Tạo bài post FB/IG từ ảnh + mô tả AI
- [ ] Price list export (theo kênh: Horeca, Retail, Online)
- [ ] Email marketing templates

---

## Dependencies

```
Media Library
├── src/lib/imgbb.ts          → ImgBB API
├── prisma/schema.prisma      → ProductMedia model
├── src/lib/cache.ts          → cached() for stats
└── Sidebar.tsx               → Marketing nav group

Future phases:
├── Phase 2: Product Card     → Media Library + Product data
├── Phase 3: Catalog          → Media Library + Collections
└── Phase 4: Campaigns        → All of the above
```

---

## Lưu Ý Kỹ Thuật

1. **ImgBB** không có API xóa ảnh (chỉ có delete_url qua web). Xóa trong app chỉ xóa record DB, ảnh vẫn tồn tại trên ImgBB.
2. **MediaType enum** phải khớp chính xác — xem BUG-008 trong `bug-fix-lessons.md`.
3. **Stats** dùng `cached()` với TTL 30s để tránh query nặng.
4. **Upload** validate cả client-side (accept attribute) và server-side (file.type check).
5. **Multi-file upload** xử lý tuần tự (không Promise.all) để tránh rate limit ImgBB.
