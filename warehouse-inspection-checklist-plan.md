# Kế Hoạch Triển Khai: Phân Hệ Nhập Liệu & Chụp Ảnh Kiểm Tra Kho Tích Hợp Báo Cáo Checklist (Warehouse Inspection & Daily Checklist System)

> **Mã công việc:** `WMS-INSPECTION-01`  
> **Module liên quan:** `wine-erp/src/app/dashboard/warehouse`  
> **Tài liệu nguồn trích xuất:** `D:\Lyscellar\Report\Kho\So_Theo_Doi_Nhiet_Do_Do_Am.xlsx`, `D:\Lyscellar\Report\Kho\So_Kiem_Tra_Dinh_Ky_Kho_Thanh_Tri.xlsx`, `D:\Lyscellar\Wiki\wiki\processes\12_van_hanh\12.1_checklist_hang_ngay.md`, `05_kho_van\5.3_bao_quan.md`  
> **Quy tắc tuân thủ:** `GEMINI.md`, `CODEBASE.md`, Clean Code, Defense-in-Depth, P0 Docs Sync, Anti-Emoji Rule.

---

## 1. MỤC TIÊU & BỐI CẢNH

- **Bối cảnh thực tế tại Lyscellar**:
  1. Hàng ngày: Thủ kho (Anh Khánh tại Kho Thanh Trì, Chị Linh tại Kho Giang Văn Minh T1 & T2) phải đo nhiệt độ, độ ẩm mỗi 12h (8:00 sáng và 16:00 chiều), ghi vào sổ giấy, mở app điện thoại TimeMark chụp ảnh rồi gửi thủ công vào nhóm chat Zalo.
  2. Định kỳ Thứ 2 & Thứ 5 hàng tuần: Thực hiện Phiếu kiểm tra định kỳ gồm 4 nhóm tiêu chuẩn (Môi trường & Thiết bị, An ninh & Cơ sở vật chất, Tình trạng hàng hóa & Vệ sinh, Quy trình hình ảnh & Báo cáo với ảnh nhiệt ẩm kế, máy lạnh và 4 góc kho).
- **Vấn đề tồn tại**:
  - Dữ liệu bị phân tán giữa sổ giấy, tin nhắn chat và ảnh điện thoại cá nhân; khó tra cứu lịch sử khi rượu có vấn đề hoặc khi Ban Giám Đốc muốn kiểm tra.
  - Nguy cơ quên đo hoặc ghi chép đối phó không có đối soát thời gian thực.
  - Không có cảnh báo tự động khi nhiệt độ vượt ngưỡng an toàn (> 22°C - nguy cơ nấu rượu cooked wine) hoặc độ ẩm ngoài khoảng 45-65%.
- **Mục tiêu số hóa**:
  - Tích hợp toàn diện quy trình kiểm tra vào phân hệ Kho vận của Wine ERP (`/dashboard/warehouse`).
  - Giao diện tác nghiệp 1-chạm tối ưu trên điện thoại di động cho Thủ kho khi đi vòng quanh kho kiểm tra.
  - Tích hợp Live Camera đóng dấu Watermark TimeMark trực tiếp trên trình duyệt (Tên kho, Ngày giờ thực, Tọa độ GPS, Tên thủ kho), loại bỏ việc dùng app bên ngoài.
  - Hỗ trợ Offline Draft Queue (chống mất sóng 4G trong kho kín/tầng hầm), tự động đồng bộ khi có mạng trở lại.
  - Tự động kích hoạt Cảnh báo khẩn cấp qua Telegram Bot khi có sự cố vượt ngưỡng và quy trình Quản lý kho / BGĐ phê duyệt phương án khắc phục.
  - Xuất file báo cáo Excel theo đúng mẫu sổ gốc của công ty (`So_Theo_Doi_Nhiet_Do_Do_Am.xlsx` & `So_Kiem_Tra_Dinh_Ky_Kho_Thanh_Tri.xlsx`).

---

## 2. THIẾT KẾ KIẾN TRÚC & DỮ LIỆU

### 2.1. Cơ sở dữ liệu (Prisma Schema)

Bổ sung 3 Models mới vào `prisma/schema.prisma`:
1. `WarehouseInspection`: Lưu trữ phiên kiểm tra kho (Ngày, ca đo sáng/chiều, loại kiểm tra hàng ngày hay định kỳ, kho, người kiểm tra, nhiệt độ 3 vị trí, độ ẩm, đánh giá chung Đạt/Cảnh báo/Không đạt, ghi chú sự cố, phương án xử lý, thông tin quản lý duyệt).
2. `WarehouseInspectionItem`: Lưu từng đầu việc checklist của đợt kiểm tra (hạng mục kiểm tra, tiêu chuẩn yêu cầu, thực tế, đánh giá Đạt/Không đạt, đề xuất xử lý).
3. `WarehouseInspectionPhoto`: Lưu ảnh chụp bằng chứng từ camera kèm watermark, phân loại ảnh (Nhiệt ẩm kế, Máy lạnh, 4 Góc kho, Sự cố bất thường), tọa độ GPS và thời điểm chụp.

Bổ sung 4 Enums:
- `WarehouseInspectionType`: `DAILY_TEMP_HUMIDITY`, `PERIODIC_AUDIT`
- `WarehouseInspectionStatus`: `DRAFT`, `COMPLETED`, `PENDING_APPROVAL`, `RESOLVED`
- `InspectionShift`: `MORNING`, `AFTERNOON`, `NIGHT`
- `InspectionResult`: `PASSED`, `WARNING`, `FAILED`

Liên kết quan hệ:
- `Warehouse` -> `inspections: WarehouseInspection[]`
- `User` -> `inspections: WarehouseInspection[] @relation("WarehouseInspector")`
- `User` -> `approvedInspections: WarehouseInspection[] @relation("WarehouseInspectionApprover")`

### 2.2. Backend & Server Actions (`actions-inspection.ts`)

Xây dựng file `wine-erp/src/app/dashboard/warehouse/actions-inspection.ts` với các Server Actions chuẩn:
- `getWarehouseInspectionsAction`: Lấy danh sách lượt kiểm tra theo kho, ngày, loại, trạng thái, tối ưu trả về thumbnail ảnh nhẹ (~5KB) chống chậm trang.
- `createWarehouseInspectionAction`: Tiếp nhận bản ghi kiểm tra, kiểm tra ngưỡng nhiệt độ (>22°C) và độ ẩm (ngoài 45-65%). Nếu phát hiện vượt ngưỡng hoặc có mục không đạt -> gán trạng thái `PENDING_APPROVAL`, tự động kích hoạt gửi cảnh báo Telegram Bot.
- `approveWarehouseInspectionAction`: Quản lý kho / BGĐ thẩm định và xác nhận phương án khắc phục sự cố để hoàn tất đóng biên bản (`RESOLVED` / `COMPLETED`).
- `getWarehouseInspectionPhotoFullAction`: Tải ảnh độ phân giải gốc theo yêu cầu khi người dùng bấm xem to.
- `exportWarehouseInspectionExcelAction`: Xuất báo cáo Excel theo đúng form chuẩn của công ty bằng thư viện `exceljs`.

### 2.3. Frontend & UX/UI (Pure Light Luxury ERP Design System)

Tích hợp Tab mới trong `/dashboard/warehouse`:
- `InspectionTab.tsx`:
  - **Sub-tab 1: Sổ Nhiệt Ẩm 12h (Daily Log)**:
    - Bảng lịch sử theo ngày, phân chia rõ Ca Sáng (8:00) và Ca Chiều (16:00).
    - Nút bấm lớn "Nhập Ca Đo Nhanh" (chọn kho, nhiệt độ 3 vị trí, độ ẩm, chụp ảnh nhiệt kế).
    - Biểu đồ nhiệt độ & độ ẩm trực quan với dải màu an toàn (xanh lá), cảnh báo (vàng), nguy hiểm (đỏ).
  - **Sub-tab 2: Phiếu Kiểm Tra Định Kỳ T2 & T5 (Periodic Audit)**:
    - Danh sách 4 nhóm tiêu chuẩn đánh giá Đạt/Không đạt 1-chạm:
      * Nhóm I: Môi trường & Thiết bị bảo quản (Nhiệt độ, độ ẩm, máy lạnh, máy hút ẩm).
      * Nhóm II: An ninh & Cơ sở vật chất (Cửa/ổ khóa, camera, mái/trần/tường, xung quanh, điện chiếu sáng, bình PCCC).
      * Nhóm III: Tình trạng hàng hóa & Vệ sinh (Thùng chai, pallet cách tường >=10cm, côn trùng chuột bọ, vệ sinh sàn).
      * Nhóm IV: Chụp ảnh TimeMark (Nhiệt kế, máy lạnh, 4 góc kho) & Ghi nhận sự cố.
  - **Sub-tab 3: Giám Sát & Phê Duyệt Quản Lý (Executive Oversight)**:
    - Lọc nhanh các phiếu có cảnh báo bất thường chờ duyệt.
    - Modal phê duyệt phương án xử lý rủi ro và xác nhận trách nhiệm.
  - **Sub-tab 4: Xuất Báo Cáo Excel**:
    - Chọn tháng/năm và kho để tải về file Excel chuẩn công ty.
- `LiveCameraInspectionModal.tsx`:
  - Kính ngắm camera HTML5 Canvas: Tự động ghi đè Watermark chữ rõ nét chân thực:
    `LYSCELLAR • KHO THANH TRÌ | 2026-10-11 11:28 | LAT: 20.95... LNG: 105.85... | NV: NGUYỄN VĂN A`
  - Nén ảnh WebP/JPEG tự động tại trình duyệt, tạo song song micro-thumbnail để tiết kiệm băng thông và bộ nhớ.
- `OfflineDraftQueue`:
  - Bắt lỗi mất kết nối mạng và lưu bản ghi vào `localStorage` (`WAREHOUSE_INSPECTION_OFFLINE_DRAFTS_V1`).
  - Thanh thông báo số bản ghi ngoại tuyến chờ đồng bộ và tự động đồng bộ khi có kết nối trở lại.

---

## 3. KẾ HOẠCH TRIỂN KHAI 5 GIAI ĐOẠN (IMPLEMENTATION PHASES)

### Giai đoạn 1: Cơ sở Dữ liệu & Đồng bộ Tài liệu Kiến trúc
- [ ] Cập nhật `prisma/schema.prisma` bổ sung 3 models (`WarehouseInspection`, `WarehouseInspectionItem`, `WarehouseInspectionPhoto`) và 4 enums.
- [ ] Chạy `npx prisma db push` để tạo bảng trên PostgreSQL.
- [ ] Chạy `npx prisma generate` cập nhật Prisma Client.
- [ ] Đồng bộ các tài liệu kỹ thuật bắt buộc: `docs/architecture/database-schema.md`, `docs/README.md`, `CODEBASE.md`, `docs/llms.txt`.

### Giai đoạn 2: Backend Logic, Server Actions & Cảnh Báo Telegram
- [ ] Xây dựng `actions-inspection.ts` với đầy đủ CRUD, xác thực quyền `requireAuth()`, serialize JSON an toàn.
- [ ] Tích hợp hàm kiểm tra ngưỡng nhiệt độ & độ ẩm tự động kích hoạt cảnh báo sự cố.
- [ ] Kết nối hàm gửi tin nhắn khẩn cấp qua Telegram Bot tới Ban Quản lý kho.
- [ ] Xây dựng chức năng xuất Excel báo cáo chuẩn bằng `exceljs`.

### Giai đoạn 3: Camera Watermark & Xử Lý Ngoại Tuyến (Offline Mode)
- [ ] Xây dựng component `LiveCameraInspectionModal.tsx` tích hợp Watermark TimeMark chuyên biệt cho kho bãi.
- [ ] Xây dựng cơ chế lưu trữ tạm ngoại tuyến `localStorage` và bộ lắng nghe sự kiện mạng `window.addEventListener('online')`.

### Giai đoạn 4: Giao Diện Người Dùng (InspectionTab) & Tích Hợp Kho Vận
- [ ] Xây dựng giao diện `InspectionTab.tsx` theo chuẩn Pure Light Design System, chia 4 sub-tabs rõ ràng.
- [ ] Tích hợp Tab "Kiểm Tra Kho" vào `WarehouseClient.tsx` và thanh điều hướng phân hệ kho vận.
- [ ] Tối ưu hóa giao diện di động (Mobile Cards, nút bấm lớn $\ge$ 48px, không auto-zoom trên iOS).

### Giai đoạn 5: Kiểm Thử, Rà Soát Lỗi & Hoàn Thiện Tài Liệu
- [ ] Chạy kiểm tra TypeScript `npm run build` hoặc `tsc --noEmit` đạt 0 lỗi.
- [ ] Kiểm thử luồng nhập liệu, chụp ảnh camera, cảnh báo ngưỡng và xuất Excel.
- [ ] Cập nhật tài liệu phân hệ `docs/modules/wms-inventory.md` và `docs/bug-fix-lessons.md` nếu có bài học kinh nghiệm.
