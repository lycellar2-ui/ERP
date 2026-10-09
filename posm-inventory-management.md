# Kế hoạch triển khai: Quản lý Kho POSM & Master Data Vật Phẩm Tiếp Thị (POSM)

## 1. Mục tiêu & Phạm vi
- **Mục tiêu**: Xây dựng phân hệ quản lý Vật phẩm Quảng cáo & Tiếp thị (POSM - Point of Sale Materials) độc lập, bao gồm Master Data danh mục POSM và Quản lý Kho Nhập/Xuất POSM, không làm ảnh hưởng đến hàng tồn kho rượu thương mại (`Product`, `StockLot`, `Warehouse`), không ảnh hưởng đến giá vốn COGS và báo cáo thuế TTĐB.
- **Vị trí tích hợp**: Tích hợp tập trung vào Tab **"Vật Phẩm POSM" (Kho POSM & Master Data)** trong phân hệ Kho Vận WMS (`/dashboard/warehouse`).
- **Nghiệp vụ cốt lõi**:
  1. Master Data POSM độc lập: Mã POSM, Tên vật phẩm, Nhóm phân loại, Đơn vị tính, Thương hiệu/Hãng tài trợ, Giá vốn ước tính, Ngưỡng cảnh báo tồn tối thiểu, Vị trí lưu kho.
  2. Phiếu Nhập kho POSM (`PIR-...`): Nhập mua mới, Hãng/Winery tài trợ, Hoàn trả sau sự kiện.
  3. Phiếu Xuất kho POSM (`PIO-...`): Cấp phát Sales/PG thị trường, Trang bị điểm bán HORECA, Quà tặng CTKM đơn hàng, Sự kiện workshop, Hư hỏng/bể vỡ. Cho phép xuất khi thiếu tồn kèm cảnh báo màu vàng (theo yêu cầu Socratic Gate).
  4. Sổ Nhật ký Giao dịch (Transaction Log): Tra cứu chi tiết từng lần biến động kho POSM.

---

## 2. Kế hoạch Thực hiện Chi tiết

- [x] **Bước 1: Cập nhật Prisma Schema & Database Models**
  - Thêm enum `PosmCategory`, `PosmTxType`, `PosmReason`
  - Thêm model `PosmProduct` và `PosmTransaction`
  - Chạy `npx prisma db push` & `npx prisma generate`

- [x] **Bước 2: Xây dựng Server Actions cho POSM (`actions-posm.ts`)**
  - CRUD Master Data POSM (`getPosmProducts`, `createPosmProduct`, `updatePosmProduct`, `deletePosmProduct`)
  - Nghiệp vụ Nhập kho POSM (`createPosmInbound`)
  - Nghiệp vụ Xuất kho POSM (`createPosmOutbound` với cảnh báo khi âm kho)
  - Truy vấn Transaction Log & Thống kê KPI tồn kho (`getPosmTransactions`, `getPosmStats`)

- [x] **Bước 3: Xây dựng Giao diện Tab POSM (`PosmInventoryTab.tsx`)**
  - Sub-tab 1: Danh mục Master Data POSM (Bảng danh mục, modal thêm/sửa, thống kê KPI, cảnh báo tồn)
  - Sub-tab 2: Quản lý Phiếu Nhập / Xuất Kho POSM (Modal lập phiếu nhập/xuất trực quan, chọn vật phẩm, tính thành tiền, cảnh báo tồn)
  - Sub-tab 3: Sổ Nhật ký Giao dịch (Lịch sử giao dịch, tìm kiếm, lọc theo loại phiếu)

- [x] **Bước 4: Tích hợp vào `WarehouseClient.tsx` & Từ điển Song ngữ `i18n.ts`**
  - Bổ sung cấu hình module POSM trong `wmsFeatureModules` (Icon `Sparkles`, màu amber sang trọng)
  - Thêm từ khóa song ngữ VI/EN trong `i18n.ts`
  - Hiển thị badge số mã POSM dưới ngưỡng tồn tối thiểu

- [x] **Bước 5: Đồng bộ Tài liệu Kiến trúc theo Docs Sync Protocol (P0)**
  - Cập nhật `docs/architecture/database-schema.md`
  - Cập nhật `docs/README.md` (Models: 130 -> 132, Enums: 82 -> 85, Server Actions: 43 -> 44)
  - Cập nhật `docs/llms.txt` (Models & Enums counts, Last updated)
  - Cập nhật `docs/modules/wms-inventory.md`

- [x] **Bước 6: Kiểm tra Chất lượng & Biên dịch TypeScript (`tsc --noEmit`)**
  - Đảm bảo 0 lỗi TypeScript (Đã xác minh qua task-488: Exit code 0)
