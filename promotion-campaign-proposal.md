# Kế Hoạch Triển Khai: Tờ Trình CTKM 1 Mã & Cơ Chế Mua Tặng Kèm Quota (Promotion Campaign Proposal)

## 1. Mục Tiêu Nghiệp Vụ
- Cho phép tạo Tờ trình **Chương Trình Khuyến Mãi (`PROMOTION_CAMPAIGN`)** áp dụng cho nhiều khách hàng theo phân loại kênh (**Bán buôn**, **Doanh nghiệp**, **Bán lẻ**, **HORECA**).
- Thiết lập cơ chế **Mua hàng tặng hàng (Buy X Get Y)**: Mua X chai sản phẩm A tặng Y chai sản phẩm A hoặc sản phẩm B (quà tặng linh hoạt).
- Quản lý **Hạn mức số lượng tối đa**: Giới hạn tổng số lượng toàn chiến dịch VÀ giới hạn tối đa trên mỗi đơn hàng.
- Quản lý **Thời gian áp dụng**: Từ ngày (`startDate`) đến ngày (`endDate`).
- **Tích hợp Bán Hàng (SO)**: Khi tạo đơn hàng, hệ thống nhận diện kênh khách hàng và hiển thị badge thông báo đạt điều kiện để Sales bấm xác nhận nạp dòng quà tặng 0 VNĐ.

---

## 2. Danh Sách Nhiệm Vụ (Task Breakdown)

- [x] **Task 1: Cấu trúc dữ liệu & Server Actions Tờ trình** (`proposals/actions.ts`)
  - Cho phép lưu trữ cấu hình CTKM trong `scope` (dạng JSON: channels, buyProductId, buyQty, giftProductId, giftQty, maxTotalQty, maxQtyPerOrder) và tự động ghi nhận vào `priceItems` (mã mua + mã tặng 0đ).
- [x] **Task 2: Giao diện Form Tạo Tờ Trình CTKM** (`proposals/ProposalsClient.tsx`)
  - Thêm khối cấu hình riêng khi chọn `category === 'PROMOTION_CAMPAIGN'`:
    - Bộ chọn Kênh áp dụng (Bán buôn, Doanh nghiệp, Bán lẻ, HORECA, hoặc Tất cả).
    - Bộ chọn Thời gian khuyến mãi (`startDate` -> `endDate`).
    - Chọn 1 mã sản phẩm mua (SKU) + Số lượng mua tối thiểu (X).
    - Chọn cơ chế quà tặng: Tặng chính SKU này HOẶC chọn SKU khác (ly, khui rượu, vang quà tặng) + Số lượng tặng (Y).
    - Thiết lập Quota: Tổng số lượng toàn chiến dịch + Tối đa trên mỗi đơn hàng.
    - Tự động tính toán ngân sách ước tính (`estimatedAmount`).
- [x] **Task 3: Hiển thị Chi Tiết & Bản In Song Ngữ CTKM** (`proposals/ProposalsClient.tsx`)
  - Hiển thị khối tóm tắt cơ chế CTKM trong Drawer chi tiết tờ trình.
  - Tích hợp nội dung CTKM vào mẫu in A4 song ngữ (Bilingual Print Engine).
- [x] **Task 4: Tích hợp Gợi Ý Quà Tặng trên Đơn Hàng (SO)** (`sales/CreateSODrawer.tsx`)
  - Khi chọn Tờ trình CTKM: Kiểm tra thời hạn hiệu lực và kênh của khách hàng (`customer.channel`).
  - Khi đơn hàng có dòng sản phẩm chính đạt số lượng mua >= X:
    - Hiển thị Banner/Badge gợi ý: *"🎁 Đạt điều kiện CTKM [Mã TT]: Mua {N} tặng {M} {Tên SP Quà Tặng}"*.
    - Nút bấm `[ + Thêm {M} chai quà tặng (0 VNĐ) ]` để tự động nạp dòng quà tặng (`unitPrice: 0`, `priceSource: 'PROMOTION_GIFT'`).
- [x] **Task 5: Docs Sync Protocol (P0)**
  - Cập nhật [proposals-approval.md](file:///d:/Lyruou/docs/modules/proposals-approval.md) mô tả quy trình Tờ trình CTKM mua hàng tặng hàng.
  - Cập nhật ngày tháng và trạng thái tài liệu.
- [x] **Task 6: Kiểm Thử & Xác Minh (Verification)**
  - Kiểm tra tạo mới tờ trình CTKM với đầy đủ cấu hình.
  - Kiểm tra xem chi tiết và in tờ trình.
  - Kiểm tra luồng duyệt và liên kết đơn hàng SO để hiển thị badge quà tặng.
  - Chạy `npx tsc --noEmit` xác nhận 0 lỗi type/lint (Exit code 0).
