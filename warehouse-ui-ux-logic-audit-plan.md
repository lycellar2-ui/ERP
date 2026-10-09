# 📋 MASTER PLAN: Kế Hoạch Rà Soát Toàn Diện UI/UX & Logic Phân Hệ Kho Hàng (WMS) — Wine ERP

> **Mã Đề Án:** `WMS-AUDIT-REFACTOR-NIGHT-2026`  
> **Chuyên gia phụ trách:** `project-planner` phối hợp cùng `frontend-specialist` & `backend-specialist`  
> **Thời gian thực hiện dự kiến:** Đêm nay (23:00 — 05:30)  
> **Phạm vi hệ thống:** Phân hệ Kho Hàng WMS (`wine-erp/src/app/dashboard/warehouse`) và các module kết nối mật thiết (`stock-count`, `transfers`, `delivery`, `procurement`, `sales`)  
> **Tài liệu tham chiếu:** `docs/modules/wms-inventory.md`, `CODEBASE.md`, `docs/architecture/data-flow.md`, `docs/bug-fix-lessons.md`

---

## 1. Hiện Trạng & Bản Đồ Kiến Trúc Phân Hệ Kho (Architecture Inventory)

Phân hệ Kho hàng (`/dashboard/warehouse`) là "trái tim" vận hành của toàn bộ doanh nghiệp phân phối rượu vang, quản lý hàng hóa có giá trị rất cao, bảo quản theo điều kiện nhiệt độ nghiêm ngặt, niên vụ (Vintage), và ràng buộc pháp lý xuất nhập khẩu.

### 1.1. Cấu Trúc Thành Phần Giao Diện (11 Phân Hệ Con / Tabs)
1. **WarehouseClient (`WarehouseClient.tsx` - 89 KB):** Hub điều hướng chính gồm 2 chế độ hiển thị (Grid Chức năng trung tâm & Workspace tabs chi tiết), bộ lọc kho/trạng thái/tìm kiếm, chỉ số KPI Header, Polling cảnh báo âm thanh đơn xuất pending.
2. **Danh mục Tồn kho & Lô hàng (`inventory`):** Bảng danh sách Stock Lots, đối soát song song Tồn Sổ Sách (`qtyBook`) vs Tồn On-hand (`qtyOnHand`) vs Khả dụng (`qtyAvailable`), lọc theo loại rượu/quốc gia/niên vụ, xuất CSV/Excel.
3. **Phiếu Nhập kho (`GoodsReceiptTab.tsx` - 98 KB):** Quản lý GR nhập từ PO/Container, kiểm tra chất lượng (QC), gắn vị trí lưu kho ban đầu, in phiếu nhập kho.
4. **Phiếu Xuất kho (`DeliveryOrderTab.tsx` - 87 KB):** Xử lý đơn xuất DO từ đơn bán hàng (SO), giải thuật gán lô tự động theo chuẩn FIFO bắt buộc, in Packing list, biên bản giao nhận.
5. **Quản lý Vị trí Kệ (`LocationManager.tsx` - 18 KB):** Phân cấp 4 tầng: Warehouse → Zone → Rack → Bin; kiểm soát tải trọng, dung tích thùng, kiểm soát nhiệt độ (Climate-controlled).
6. **Khu vực Cách ly & Hủy hàng (`quarantine`):** Lô hàng lỗi nút chai (Corked), vỡ, hỏng nhiệt độ, nghi ngờ chất lượng; luồng chuyển cách ly và phê duyệt thanh lý/hủy kho (Write-off).
7. **Báo cáo Nhập - Xuất - Tồn (`StockMovementTab.tsx` - 60 KB):** Thẻ kho chi tiết từng SKU/Lot, đối soát Tồn đầu kỳ + Nhập trong kỳ - Xuất trong kỳ = Tồn cuối kỳ, tính giá vốn xuất kho theo FIFO.
8. **Sơ đồ Kho 2D Trực quan (`WarehouseMapTab.tsx` - 70 KB):** Bản đồ visual hiển thị heatmap tỷ lệ lấp đầy kho, vị trí rack/bin, tìm nhanh SKU trên sơ đồ mặt bằng.
9. **Điều chuyển Kho Nội bộ (`TransfersTab.tsx` - 23 KB):** Luồng điều chuyển hàng hóa giữa các kho (Kho Tổng HCM <-> Kho Hà Nội <-> Showroom), bảo toàn thông tin Niên vụ (Vintage) và lô gốc.
10. **Kiểm kê Kho Định kỳ (`StockCountTab.tsx` / `stock-count`):** Phiếu kiểm kê thực tế theo đợt, so sánh độ lệch (Variance), ghi nhận thừa/thiếu và phát sinh phiếu điều chỉnh kho (Stock Adjustment).
11. **Kho Hàng Mẫu Tasting (`SampleInventoryTab.tsx` - 42 KB) & Bổ sung Tồn kho (`ReplenishmentTab.tsx` - 33 KB):** Quản lý hạn mức xuất mẫu nếm thử rượu vang (Sommelier/Sales) và cảnh báo ngưỡng tồn kho an toàn Min-Max (Safety stock).

### 1.2. Các Tệp Logic Backend (Server Actions - 220+ KB)
- `actions.ts` (117 KB, 2.956 dòng): CRUD Kho, Lô hàng, Cân chỉnh tồn, Quản lý cách ly, Write-off, Polling realtime, Báo cáo WMS Stats.
- `actions-gr.ts` (12.5 KB): Nghiệp vụ Nhập kho (Goods Receipt), phân bổ lô, kiểm định chất lượng, gắn vị trí kệ.
- `actions-do.ts` (16.7 KB): Nghiệp vụ Xuất kho (Delivery Order), thuật toán FIFO chọn lô, giữ chỗ (Reserve/Allocate), hoàn tất xuất hàng.
- `actions-nxt.ts` (35.7 KB): Báo cáo Nhập Xuất Tồn đa kho, tính toán biến động theo kỳ ngày tháng, khắc phục lệch số liệu luân chuyển.
- `actions-map.ts` (13.4 KB): Quản lý layout tọa độ 2D sơ đồ kho, cập nhật vị trí các kệ.
- `actions-sample.ts` (12.1 KB): Luồng xuất kho hàng mẫu, hạn mức theo nhân viên/phòng ban.
- `actions-print.ts` (5.5 KB): Tạo mã HTML/mẫu in ấn cho phiếu xuất, phiếu nhập và nhãn chai/thùng.

---

## 2. Mục Tiêu & Trọng Tâm Rà Soát Đêm Nay (Key Audit Dimensions)

Việc rà soát được phân tích theo mô hình "Kiềng 3 Chân" nhằm đảm bảo không bỏ sót bất kỳ góc khuất nào:

```
                      ┌─────────────────────────────────────────┐
                      │        TOÀN DIỆN KHO HÀNG WMS           │
                      └────────────────────┬────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
┌────────▼──────────────┐       ┌──────────▼────────────┐       ┌────────────▼──────────┐
│   CHIỀU 1: UI/UX      │       │   CHIỀU 2: BUSINESS   │       │   CHIỀU 3: PERFORMANCE│
│   & DESIGN TASTE      │       │   LOGIC & DATA FLOW   │       │   & DATABASE SAFETY   │
├───────────────────────┤       ├───────────────────────┤       ├───────────────────────┤
│ • Đồng bộ Design Token│       │ • Bắt buộc FIFO tuyệt │       │ • Triệt tiêu Waterfall│
│   (Light/Dark theme)  │       │   đối khi xuất kho    │       │ • Supabase pool <= 3  │
│ • Không chữ tàng hình │       │ • Đồng bộ On-hand vs  │       │ • In-memory cache     │
│ • Bố cục bàn phím &   │       │   Book stock vs Khả   │       │   với TTL hợp lý      │
│   thao tác nhanh kho  │       │   dụng (Available)    │       │ • Không zombie process│
│ • Responsive Mobile & │       │ • Bảo toàn Niên vụ    │       │ • Decimal serialization│
│   Tablet (PDA thủ kho)│       │   (Vintage) điều chuyển│      │   JSON.parse(stringify│
│ • Đầy đủ loading state│       │ • Kiểm tra quyền RBAC │       │ • Phòng chống Race    │
│   & skeleton mượt mà  │       │   trên UI & Server    │       │   Condition xuất âm kho│
└───────────────────────┘       └───────────────────────┘       └───────────────────────┘
```

---

## 3. Danh Mục Các Hạng Mục Kiểm Tra Chi Tiết (Audit Checklists)

### 3.1. Rà Soát Logic Nghiệp Vụ & Ràng Buộc Dữ Liệu (Business Logic)
- [ ] **FIFO Strict Enforcement:** Kiểm tra `actions-do.ts` khi auto-allocate lô hàng. Đảm bảo lô nhập ngày sớm nhất (`receivedDate` asc) luôn được chọn trước; nếu thủ kho chọn lô khác phải có lý do và ghi nhận `AuditLog`.
- [ ] **Công thức Tồn Kho 3 Cột:**
  - `Tồn Sổ Sách (qtyBook)` = Tổng nhập - Tổng xuất đã hoàn thành.
  - `Tồn Thực Tế On-Hand (qtyOnHand)` = Tổng số chai thực tế trên sàn kho = `qtyAvailable + qtyReserved`.
  - `Tồn Khả Dụng (qtyAvailable)` = `qtyOnHand - qtyReserved`.
  - Huy hiệu cảnh báo chênh lệch phải hiển thị chuẩn xác khi `qtyOnHand !== qtyBook`.
- [ ] **Không Cho Phép Tồn Kho Âm (Zero/Negative Stock Guard):**
  - Mọi thao tác xuất kho DO, chuyển kho, xuất mẫu, kiểm kê giảm phải wrap trong Transaction có điều kiện `qtyAvailable >= qtyRequest`. Bắt lỗi và thông báo thân thiện.
- [ ] **Bảo Toàn Metadata Niên Vụ (Vintage) & Landed Cost:**
  - Khi điều chuyển kho (`TransfersTab` / `receiveTransferOrder`), lô mới sinh ở kho nhận phải kế thừa 100% Niên vụ (Vintage), HS Code, Đơn giá vốn Landed Cost của lô gốc.
- [ ] **Phân Quyền RBAC Phân Minh:**
  - Thủ kho (`THU_KHO`): Không được thấy các nút tạo đơn hàng bán, xuất hóa đơn VAT, sửa giá bán (đã từng có tiền lệ BUG-042).
  - Nhân viên thường: Không thể tự ý xuất hủy (Write-off) hoặc xóa vị trí kệ đang có hàng.
- [ ] **Xử Lý Hủy Kho (Write-Off) & Cách Ly (Quarantine):**
  - Chuyển lô vào Quarantine phải khóa ngay không cho SO giữ chỗ (`status = QUARANTINE`).
  - Hủy kho phải yêu cầu nhập biên bản, hình ảnh, mã nhân sự thực hiện và bút toán ghi giảm tồn.

### 3.2. Rà Soát Giao Diện UI, Trải Nghiệm UX & Khả Năng Thao Tác (UI/UX Ergonomics)
- [ ] **Kiểm Tra Lỗi Màu Sắc & Tương Phản (No White-on-White / No Violet):**
  - Đảm bảo tuân thủ bộ màu chuẩn: Thẻ trạng thái, Badge, input fields đều hiển thị rõ nét trên nền sáng lẫn nền tối. Không có hiện tượng chữ trắng chìm trên nền trắng (như lỗi BUG-034 trước đây).
- [ ] **Tối Ưu Hóa Bảng Dữ Liệu (Dense Data Tables):**
  - Bảng tồn kho, bảng phiếu nhập/xuất cần có độ cao dòng hợp lý (compact rows), căn phải số lượng và tiền tệ, căn giữa ngày tháng và trạng thái.
  - Sticky Header khi cuộn bảng dài để người dùng không mất dấu cột.
- [ ] **Trải Nghiệm Thao Tác Thủ Kho Tại Sàn (Mobile & PDA Scanner):**
  - Kiểm tra giao diện quét Barcode/QR và tìm kiếm nhanh SKU trên điện thoại thông minh/thiết bị cầm tay.
  - Các nút hành động chính (Nhập kho, Xác nhận picking, Quét barcode) phải có diện tích bấm (touch target) tối thiểu 44x44px.
- [ ] **Phản Hồi Trạng Thái Tức Thì (Optimistic Updates & Toast Notifications):**
  - Khi xác nhận picking hoặc đổi trạng thái đơn, UI cập nhật ngay kèm thanh tiến trình nhẹ, tránh hiện tượng đơ giật khiến thủ kho bấm đúp 2 lần.
  - Cảnh báo âm thanh (`wms_audio_notify`) khi có đơn xuất kho mới cần mượt mà, không bị trình duyệt chặn (fallback khéo léo).
- [ ] **Đồng Bộ Song Ngữ (Bilingual VI/EN):**
  - Mọi tiêu đề, bộ lọc, tooltip, nút bấm và thông báo lỗi trong `i18n.ts` phải có đầy đủ cả 2 ngôn ngữ, không còn sót chuỗi text hardcode.

### 3.3. Rà Soát Hiệu Năng & An Toàn Cơ Sở Dữ Liệu (Performance & Database)
- [ ] **Bảo Vệ Supabase Connection Pool (`max: 3`):**
  - Rà soát các hàm trong `actions.ts`, `actions-nxt.ts`: Chuyển các chuỗi truy vấn nối tiếp (waterfall) thành `Promise.all()` hoặc gom lệnh Prisma.
  - Kiểm tra việc áp dụng bộ nhớ đệm `cached()` với các danh mục ít thay đổi (kho, vị trí kệ).
- [ ] **Serialization An Toàn Cho Next.js Client Component:**
  - Đảm bảo toàn bộ đối tượng Prisma (đặc biệt là kiểu `Decimal`, `Date`) đều đi qua hàm `serialize()` hoặc `JSON.parse(JSON.stringify(raw))` trước khi trả về Client.
- [ ] **Phân Trang & Tải Trễ (Pagination & Virtualization):**
  - Tránh fetch 10.000 lô hàng cùng lúc; áp dụng phân trang (Pagination 50-100 items/page) hoặc lazy-load khi cuộn đối với danh sách lô hàng.

---

## 4. Lộ Trình 5 Khung Giờ Thực Hiện Đêm Nay (Execution Schedule)

```
┌────────────────────────────────────────────────────────────────────────┐
│ SPRINT 1 (23:00 - 00:30): RÀ SOÁT DATA INTEGRITY & SERVER ACTIONS     │
│ Audit actions.ts, actions-gr.ts, actions-do.ts, actions-nxt.ts        │
│ Kiểm tra FIFO, transaction locks, zero-stock guard, decimal serial    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ SPRINT 2 (00:30 - 02:00): RÀ SOÁT UI/UX CÁC TABS CỐT LÕI (CORE WMS)    │
│ Tồn kho (Inventory), Nhập kho (GR), Xuất kho (DO), Bảng điều khiển     │
│ Sửa triệt để tương phản màu sắc, responsive, sticky header, drawer UX  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ SPRINT 3 (02:00 - 03:30): RÀ SOÁT LOGISTICS & CÁC TABS VẬN HÀNH PHỤ    │
│ Điều chuyển (Transfers), Kiểm kê (Stock Count), Hàng mẫu, Bổ sung tồn │
│ Đảm bảo bảo toàn Vintage, tính toán chênh lệch variance chính xác      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ SPRINT 4 (03:30 - 04:30): RÀ SOÁT SƠ ĐỒ KHO 2D & THẺ KHO (NXT)        │
│ WarehouseMapTab (tương tác map, rack occupancy, touch mobile)         │
│ StockMovementTab (chính xác tồn đầu kỳ, nhập, xuất, luân chuyển)      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ SPRINT 5 (04:30 - 05:30): VERIFICATION, TYPE-CHECK & ĐỒNG BỘ TÀI LIỆU │
│ Chạy npm run type-check, kiểm tra lỗi console, cập nhật docs           │
│ docs/modules/wms-inventory.md, docs/bug-fix-lessons.md                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Tiêu Chí Hoàn Thành (Definition of Done - DoD)

1. ✅ 100% các Server Actions của phân hệ kho trả về dữ liệu an toàn (đã serialize, có kiểm tra quyền, không throw unhandled exception).
2. ✅ Quy tắc FIFO và bảo vệ không xuất âm kho hoạt động trơn tru trong mọi kịch bản.
3. ✅ Giao diện 11 tabs chuẩn chỉ về mặt thị giác: Không lỗi màu sắc, tương phản đạt chuẩn WCAG, thân thiện trên cả màn hình lớn và thiết bị di động.
4. ✅ Không gây nghẽn DB Connection Pool trên Supabase.
5. ✅ `npm run type-check` (hoặc TypeScript check) xanh 100%, không phát sinh regression bug ở các phân hệ liên quan (Sales, Procurement, Accounting).
6. ✅ Tài liệu `docs/modules/wms-inventory.md` và `docs/bug-fix-lessons.md` được cập nhật đồng bộ ngay sau các tinh chỉnh.
