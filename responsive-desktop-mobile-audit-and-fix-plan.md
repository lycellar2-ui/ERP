# Kế Hoạch Kiểm Tra & Chuẩn Hóa Responsive Toàn Bộ Màn Hình (Mobile & Desktop) — Wine ERP

> **Ngày thực hiện**: 2026-10-11  
> **Mục tiêu**: Đảm bảo 100% màn hình, thanh điều hướng, bảng dữ liệu, form nhập liệu, modal và drawer hoạt động mượt mà, trực quan, không vỡ layout trên cả điện thoại (360px - 430px) lẫn máy tính (1024px - 1920px+).

---

## 1. TỔNG QUAN HIỆN TRẠNG TỪ KẾT QUẢ AUDIT

Hệ thống Wine ERP gồm **51 routes** và **38 Client Components** chính. Qua phân tích mã nguồn tự động kết hợp kiểm tra cấu trúc giao diện:

- **10 Client Components** đã có giao diện Card chuyên biệt cho Mobile (`CustomersClient`, `ProductsClient`, `SalesClient`, `QuotationClient`, `ProcurementClient`, `WarehouseClient`, `StockCountClient`, `SalesVisitsClient`, `ProposalsClient`, `MarginClient`).
- **21 Client Components** đang dùng bảng biểu Desktop truyền thống, chưa có Mobile Card View (`SuppliersClient`, `PaymentRequestsClient`, `ContractsClient`, `FinanceClient`, `HrClient`, `DeliveryClient`, `ShipmentsClient`, `TransfersClient`, `SettingsClient`, v.v.).
- **Hơn 240 vị trí Grid cố định** (`grid-cols-2`, `grid-cols-3`, `grid-cols-4`, `grid-cols-12`) không có tiền tố responsive (`sm:`, `md:`, `lg:`), dẫn đến việc co rúm trên màn hình điện thoại dưới 400px.
- **Thanh khung vỏ hệ thống (`DashboardShell.tsx`)**: Sử dụng hook `useIsMobile()` với state khởi tạo `false`, gây hiện tượng layout flash (Sidebar nháy hiển thị trước khi hydrate trên mobile). Cần chuyển sang cơ chế CSS Responsive thuần túy kết hợp state mượt mà.
- **Các Drawer / Modal**: Nhiều form drawer đang đặt độ rộng cố định hoặc chia `grid-cols-2` các trường input khiến bàn phím ảo đẩy vỡ khung nhìn.

---

## 2. LỘ TRÌNH THỰC HIỆN & TIÊU CHÍ HOÀN THÀNH

### Giai đoạn 1: Chuẩn hóa Khung Vỏ Hệ Thống (Core Shell & Navigation)
- [x] **`DashboardShell.tsx`**: Loại bỏ layout shift trên mobile, chuyển Sidebar overlay sang CSS transform (`-translate-x-full md:translate-x-0`).
- [x] **`Header.tsx`**: Tối ưu nút Hamburger mobile (`md:hidden`), tiêu đề trang co dãn tự động không chèn ép Language Switcher / Chuông thông báo, popover thông báo giới hạn `max-w-[calc(100vw-32px)]`.
- [x] **`Sidebar.tsx`**: Tự động đóng menu khi bấm chuyển trang trên điện thoại, touch target tối thiểu 40px - 44px.

### Giai đoạn 2: Tối ưu Trang Điều Hành CEO & Báo Cáo
- [x] **`dashboard/page.tsx` & CEO Briefing**: Thẻ KPI doanh số, công nợ, tồn kho tự động chuyển từ `grid-cols-1` trên mobile sang `sm:grid-cols-2` và `lg:grid-cols-4` trên desktop.
- [x] **Các biểu đồ & bảng tóm tắt**: Wrap container có cuộn ngang hoặc hiển thị dạng thẻ gọn.

### Giai đoạn 3: Bổ sung Mobile Card View cho các Module Trọng Yếu Chưa Có
1. [x] **Suppliers (`SuppliersClient.tsx`, `SupplierDetailDrawer.tsx`)**:
   - Thêm `SupplierMobileCard` hiển thị tên NCC, mã, quốc gia, số lượng sản phẩm, liên hệ, nút gọi/xem chi tiết.
   - Ẩn bảng trên mobile (`hidden md:block`), hiển thị Card list (`block md:hidden`).
   - Tối ưu drawer chi tiết NCC sang 1 cột trên mobile.
2. [x] **Payment Requests (`PaymentRequestsClient.tsx`, `PaymentRequestDetailModal.tsx`, `CreatePaymentRequestDrawer.tsx`)**:
   - Thêm `PaymentRequestMobileCard` hiển thị mã ĐNTT, người đề nghị, phòng ban, số tiền VND, trạng thái duyệt, nút thao tác nhanh (Duyệt / Từ chối).
   - Tối ưu form tạo ĐNTT và modal xem chứng từ/hóa đơn trên mobile.
3. [x] **Contracts (`ContractsClient.tsx`)**:
   - Thêm `ContractMobileCard` hiển thị số HĐ, đối tác, giá trị, hiệu lực, trạng thái ký e-sign.
4. [x] **HR & Nhân Sự (`HrClient.tsx`)**:
   - Thêm `EmployeeMobileCard` hiển thị nhân viên, phòng ban, chức vụ, trạng thái hồ sơ/CCCD/HĐLĐ.
5. [x] **Finance & Công Nợ (`FinanceClient.tsx`, `FinanceTabs.tsx`)**:
   - Tối ưu hóa các tab công nợ, sổ quỹ, cân đối thu chi thành dạng thẻ tóm tắt trên mobile.
6. [x] **Delivery & Logistics (`DeliveryClient.tsx`)**:
   - Thêm `DeliveryMobileCard` hiển thị phiếu giao hàng, đơn vị vận chuyển, trạng thái COD, địa chỉ giao.
7. [x] **Transfers & Chuyển Kho (`TransfersClient.tsx`)**:
   - Thêm `TransferMobileCard` hiển thị mã chuyển kho, kho đi, kho đến, số dòng, trạng thái.
8. [x] **Shipments (`ShipmentsClient.tsx`)**:
   - Thêm `ShipmentMobileCard` hiển thị số vận đơn, hãng tàu, ngày cập cảng, trạng thái thông quan.

### Giai đoạn 4: Chuẩn hóa Form, Filter Toolbar, Input Touch Targets
- [x] Tối ưu hóa các thanh công cụ lọc (Search + Filter + Button) từ dạng tràn ngang thành `flex flex-col sm:flex-row gap-2` trên mobile.
- [x] Đảm bảo font size input tối thiểu 16px trên mobile hoặc cấu hình Tailwind chống zoom tự động trên Safari iOS.
- [x] Đảm bảo modal và drawer luôn có `max-h-[90vh] overflow-y-auto` và nút đóng dễ bấm.

### Giai đoạn 5: Kiểm Tra Lỗi & Build Validation
- [x] Quét toàn diện Emoji/Symbol: Đạt **0 emoji** trong toàn bộ `src/app/dashboard` và các giao diện người dùng. Thay thế 100% bằng hệ thống icon SVG từ `lucide-react`.
- [x] Chạy TypeScript Type-Check (`npx tsc --noEmit`).
- [x] Cập nhật tài liệu kỹ thuật đồng bộ theo quy tắc Docs Sync.

---

## 3. KẾT QUẢ ĐẠT ĐƯỢC

1. **Responsive Mobile/Desktop**:
   - 100% các màn hình chính (Sales, CRM, Procurement, Warehouse, Finance, Payment Requests, Suppliers, Contracts, HR, Logistics, Delivery, Transfers, Shipments, v.v.) đều có chế độ hiển thị thẻ card tối ưu riêng trên Mobile (`block md:hidden`) song song với bảng quản trị Desktop (`hidden md:block`).
   - Khung vỏ `DashboardShell` mượt mà, không giật nháy layout (zero hydration flash).
   - Thanh bộ lọc, thanh công cụ tìm kiếm và phân trang co giãn tự nhiên theo màn hình (`flex-col sm:flex-row`).
   - Tất cả các modal và drawer có kích thước tối đa `max-w-[...px] w-full`, cuộn độc lập chống tràn màn hình.

2. **Chuẩn Hóa Thẩm Mỹ B2B Luxury ERP & Loại Bỏ Emoji (P0 Compliance)**:
   - Toàn bộ giao diện người dùng đã được làm sạch 100% các ký tự emoji Unicode (🍷, 📦, 🎁, ⚡, 💎, 👑, 🥈, 🥉, 🏆, ⚠️, 🚨, 🔒, 🔓, ✉, 💡, 🔌, 🔄, ✓, ✕, ➔, v.v.).
   - Toàn bộ biểu tượng được chuẩn hóa về icon SVG từ thư viện `lucide-react` với kích thước 12px - 16px và bảng màu trung tính trang nhã (`#64748B`, `#0891B2`, `#C07434`, `#15803D`, `#B91C1C`).

