# Phân Hệ Quản Lý Tem Rượu (STP)

> **Mã phân hệ:** `STP`  
> **Route chính:** `/dashboard/stamps`  
> **Mục tiêu:** Quản lý phôi tem rượu nhập khẩu do Bộ Tài Chính / Tổng cục Hải quan cấp phát; quản lý dải số seri cấp phát dán tem cho từng lô hàng nhập khẩu hoặc lô kho; lập sổ theo dõi tem điện tử (Logbook) phục vụ quyết toán thuế tiêu thụ đặc biệt theo Nghị định 105/2017/NĐ-CP và Thông tư 23/2021/TT-BTC; theo dõi biên bản hủy tem hỏng.

---

## 1. Cơ Sở Dữ Liệu & Entity Models

### 1.1. `WineStampPurchase` (Lô Phôi Tem Mua Từ Thuế)
- `id`: Mã định danh (cuid)
- `purchaseDate`: Ngày mua chứng từ
- `stampType`: Phân loại nồng độ cồn (`UNDER_20_ABV` - Rượu dưới 20° hoặc `OVER_20_ABV` - Rượu từ 20° trở lên)
- `symbol`: Ký hiệu tem (ví dụ: `AA/20P`, `NK/24`)
- `serialStart` & `serialEnd`: Dải số seri từ số đầu đến số cuối
- `totalQty`: Tổng số lượng tem mua
- `usedQty`: Số lượng tem đã xuất dán hoặc hủy hỏng
- `status`: Trạng thái (`ACTIVE`, `EXHAUSTED`, `CANCELLED`)
- `usages`: Quan hệ 1-N tới `WineStampUsage`

### 1.2. `WineStampUsage` (Nhật Ký Cấp Phát & Dán Tem / Hủy Tem)
- `id`: Mã định danh (cuid)
- `purchaseId`: Khóa ngoại tham chiếu `WineStampPurchase`
- `shipmentId`: Khóa ngoại tham chiếu `Shipment` (Lô hàng nhập khẩu - Container / Vận đơn B/L)
- `lotId`: Khóa ngoại tham chiếu `StockLot` (Lô hàng trong kho)
- `serialStart`: Số seri bắt đầu của đợt bóc dán (nhập thủ công)
- `serialEnd`: Số seri kết thúc của đợt bóc dán (nhập thủ công)
- `qtyUsed`: Số lượng tem dán thành công
- `qtyDamaged`: Số lượng tem bị rách, hỏng, mất trong quá trình dán
- `usedAt`: Thời điểm ghi nhận
- `reportedBy`: Người thực hiện / nhân viên kho
- `notes`: Ghi chú (đối với nghiệp vụ hủy tem sẽ bắt đầu bằng prefix `[HỦY TEM]`)

---

## 2. Các Chức Năng Chính

### 2.1. Quản Lý Lô Tem & Cấp Phát
- **Tổng quan tồn kho tem (KPI Cards):**
  - Theo dõi số lượng còn lại, số đã dùng, tổng số tem theo từng nhóm nồng độ cồn (< 20° ABV và ≥ 20° ABV).
  - Thanh tiến độ sử dụng trực quan với màu cảnh báo khi tồn kho tem xuống thấp.
- **Hệ thống cảnh báo tự động:**
  - Cảnh báo tồn kho khi lô tem đã dùng trên 85% (Warning) hoặc trên 95% (Critical).
  - Cảnh báo tỷ lệ tem hỏng/rách bất thường khi vượt quá 5% tổng số lượng.
- **Khai báo lô tem mới:**
  - Nhập ngày mua chứng từ, loại nồng độ cồn, ký hiệu tem, dải số seri và tổng số lượng.

### 2.2. Phân Tem Rượu Cho Lô Hàng / Lô Kho
- Modal cấp phát và ghi nhận dán tem:
  - Chọn mục đích cấp phát: Dán cho Lô hàng nhập khẩu (`Shipment`) hoặc Lô tồn kho (`StockLot`).
  - Dropdown chọn vận đơn B/L lô hàng hoặc số lô kho kèm tên sản phẩm.
  - Nhập dải số seri thực tế bóc dán (Seri bắt đầu - Seri kết thúc).
  - Nhập số lượng dán và số lượng tem rách/hỏng phát sinh.
  - Giao dịch nguyên tử (Atomic transaction): Khấu trừ trực tiếp số lượng khả dụng của lô tem và tự động chuyển trạng thái `EXHAUSTED` khi hết tem.

### 2.3. Phân Bổ Tem Rượu & Phiếu Chỉ Dẫn Dán Tem Theo PO (PO Stamp Allocation & Sticking Guide)
- **Cơ chế hoạt động:**
  - Áp dụng cho các Đơn mua hàng đã nhận kho (`RECEIVED`, `PARTIALLY_RECEIVED` hoặc đã có Phiếu Nhập Kho `GoodsReceipt`).
  - Người dùng chọn đơn PO và chọn lô phôi tem xuất kho tương ứng (< 20° ABV hoặc ≥ 20° ABV).
  - Nhập số seri bắt đầu của PO (ví dụ: `001001` hoặc `1254080`). Hệ thống tự động tính nối tiếp (contiguous sequential) dải số seri (Số đầu → Số cuối) cho từng sản phẩm trong PO theo số lượng thực nhận.
  - **Phân chia theo điểm đến (Kho Thanh Trì & Showroom):**
    - Hỗ trợ nhập số lượng chuyển về Showroom (`qtySR`) cho từng dòng sản phẩm.
    - Hệ thống tự động chia dải tem thành 2 dải con liên tục:
      - *Kho Thanh Trì (Kho chính):* `SL = Tổng - SR`, dải tem từ `Bắt đầu` đến `Bắt đầu + SL Kho - 1`.
      - *Showroom (SR):* `SL = SR`, dải tem từ `Kết thúc Kho + 1` đến `Kết thúc tổng`.
    - Chuẩn hóa theo quy trình thực tế từ file đối soát phân tem.
  - Hệ thống kiểm soát tồn kho tem khả dụng trong giao dịch nguyên tử (Atomic Transaction), tự động tạo các bản ghi nhật ký cấp phát gắn với từng mã sản phẩm/lô kho và cập nhật số dư tồn tem.
- **Tab Phân & Dán Tem Cho PO:**
  - Bảng danh sách các đợt phân tem theo PO kèm mã PO, ngày phân bổ, nhà cung cấp, ký hiệu lô tem, dải số seri tổng.
  - Hỗ trợ xem chi tiết danh sách sản phẩm phân bổ (Accordion), hiển thị rõ số lượng và dải số seri cho cả Kho Thanh Trì và Showroom.
- **Phiếu Chỉ Dẫn Dán Tem Cho Nhân Viên Kho (Work Order Sheet):**
  - Giao diện trực quan, đơn giản, tập trung vào nhiệm vụ dán tem tại kho, hiển thị đầy đủ thông tin: Mã đơn PO, Nhà cung cấp, Lô tem, Tổng chai, Dải seri tổng.
  - **Chế độ xem Thẻ (Cards):** Tối ưu đặc biệt cho nhân viên cầm điện thoại hoặc máy tính bảng trong kho, font chữ lớn, dải số seri to rõ ràng, phân biệt rõ hộp dán Kho Thanh Trì và hộp dán Showroom.
  - **Checklist tiến độ dán:** Nhân viên chạm một chạm vào nút `[✓] Đã dán xong` để theo dõi tiến độ từng dòng sản phẩm, có thanh tiến độ tổng thể cập nhật tức thì.
  - **Chế độ xem Bảng (Table) & In ấn (Print):** Bố cục gọn gàng, hỗ trợ in ra khổ A4 sạch đẹp (`@media print`) phục vụ kẹp hồ sơ lô hàng hoặc dán lên kệ kho.

### 2.4. Sổ Theo Dõi Tem Điện Tử (Stamp Logbook)
- Trực quan hóa nhật ký nhập - xuất - dán - hủy - tồn lũy kế theo thời gian thực.
- Cột thông tin chuẩn quy định: STT, Ngày CT, Nghiệp vụ, Ký hiệu, Phân loại độ cồn, Seri đầu, Seri cuối, SL Nhập, SL Dán, SL Hỏng/Hủy, Tồn cuối lô, Lô hàng/Chứng từ liên quan, Người thực hiện, Ghi chú.
- Bộ lọc đa chiều:
  - Lọc theo Năm tài chính
  - Lọc theo Quý (Quý 1, 2, 3, 4 hoặc Cả năm)
  - Lọc theo Phân loại độ cồn (< 20° ABV, ≥ 20° ABV, hoặc Tất cả)
  - Tìm kiếm linh hoạt theo ký hiệu, số seri, mã vận đơn B/L hoặc ghi chú.
- Xuất file Excel (.xlsx):
  - Sinh file Excel chuẩn mẫu thanh tra hải quan / quyết toán thuế tiêu thụ đặc biệt.

### 2.5. Biên Bản Hủy Tem Rách / Hỏng
- Lập biên bản hủy tem hỏng theo quy định hành chính.
- Ghi nhận bắt buộc: Số lượng tem hủy, Ngày hủy, Lý do hủy (rách nát, ẩm mốc, lỗi in phôi), Họ tên người chứng kiến.
- Lưu trữ bảng lịch sử biên bản hủy tem phục vụ hậu kiểm.

---

## 3. Danh Sách Server Actions (`src/app/dashboard/stamps/actions.ts`)

| Tên Action | Mục Đích |
|---|---|
| `getStampPurchases()` | Lấy danh sách lô tem mua kèm lịch sử cấp phát và quan hệ lô hàng/lô kho |
| `getStampSummary()` | Tính toán tổng quan KPI tồn kho tem theo nồng độ cồn (có cache) |
| `createStampPurchase(data)` | Khai báo lô tem mới từ cơ quan Thuế / Hải quan |
| `recordStampUsage(data)` | Ghi nhận phân tem và dán tem (Atomic transaction) |
| `safeRecordStampUsage(data)` | Wrapper an toàn revalidate cache và route `/dashboard/stamps` |
| `getStampLinkingOptions()` | Truy vấn danh sách Lô hàng NK và Lô kho khả dụng cho phân tem |
| `getReceivedPOsForStamps()` | Lấy danh sách PO nhận về kèm chi tiết sản phẩm, nồng độ ABV và số lượng nhận |
| `allocateStampsToPO(data)` | Phân bổ tem cho đơn PO, gán dải seri cho từng sản phẩm (Atomic transaction) |
| `getPOStampAllocations()` | Lấy danh sách lịch sử phân bổ tem theo PO kèm chi tiết số đầu - số cuối từng mặt hàng |
| `getStampLogbook(filters)` | Tổng hợp dữ liệu Sổ theo dõi tem điện tử đa chiều |
| `exportStampLogbookExcel(filters)` | Xuất Sổ theo dõi tem ra định dạng Excel (.xlsx) |
| `getStampReportData(filters)` | Dữ liệu báo cáo sử dụng tem theo Quý/Năm |
| `exportStampReportExcel(filters)` | Xuất báo cáo sử dụng tem theo Quý/Năm ra Excel |
| `createStampDestruction(data)` | Lập biên bản hủy tem rách/hỏng |
| `getStampDestructions()` | Lấy danh sách lịch sử biên bản hủy tem |
| `getStampAlerts()` | Quét và trả về danh sách cảnh báo tồn tem và hao hụt |

---

## 4. Phân Quyền & RBAC
- **Quyền đọc/truy cập:** `STP:READ` (được bảo vệ trong `middleware.ts` và menu `Sidebar.tsx`).
- **Phân nhóm Sidebar:** Nhóm *Tài Chính* (kế toán quản lý tem, hải quan, thủ kho).
