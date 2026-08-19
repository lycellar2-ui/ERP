# WMS — Warehouse Management System (Quản Lý Kho Bãi)

Hệ thống quản lý kho chuyên biệt cho rượu vang nhập khẩu. Điểm đặc thù so với kho thông thường: hàng hóa có giá trị cao, dễ vỡ, nhạy cảm với nhiệt độ/ánh sáng, quản lý theo Vintage, và FIFO là bắt buộc để bảo vệ chất lượng.

---

## 1. Cấu Trúc Vị Trí Kho (Warehouse Location Hierarchy)

Kho được tổ chức theo cấu trúc 4 cấp:

```
Warehouse (Kho)
  └── Zone (Khu vực) — Ví dụ: Khu A (Rượu thường), Khu B (Grand Cru Climate-controlled), Khu Q (Quarantine)
        └── Rack (Kệ) — Ví dụ: Rack A-01, Rack A-02
              └── Bin (Ô/Ngăn) — Ví dụ: Bin A-01-01 (Tầng 1), A-01-02 (Tầng 2)...
```

**Thông tin mỗi Location:**
- `location_code`: Mã địa chỉ tự sinh (A-01-03)
- `location_type`: STORAGE / RECEIVING / SHIPPING / QUARANTINE / VIRTUAL
- `capacity_cases`: Số thùng tối đa có thể chứa
- `temperature_controlled`: Boolean — Có kiểm soát nhiệt độ không?
- `current_occupancy`: % hiện tại đang dùng (Real-time)
- `posX`, `posY`: Tọa độ hiển thị trên bản đồ 2D (Float)
- `width`, `height`: Kích thước hiển thị trên bản đồ 2D (Float)

**Kho ảo (Virtual Location):**
- `IN_TRANSIT`: Hàng trên tàu/xe đang về
- `CONSIGNED`: Hàng đang ký gửi tại HORECA (xem CSG module)
- `PRODUCTION_LOSS`: Hàng đã ghi nhận bể vỡ / hao hụt

---

## 2. Quản Lý Lô Hàng (Stock Lot / Batch)

Mỗi lô hàng nhập về được tạo 1 **Stock Lot** — đơn vị truy xuất nguồn gốc cơ bản:

| Trường | Mô tả |
|---|---|
| `lot_number` | Số lô (tự sinh, liên kết với Shipment/Container) |
| `linked_shipment` | Container / Bill of Lading tương ứng |
| `linked_po` | Purchase Order gốc |
| `product_sku` | SKU rượu vang |
| `qty_received` | Số lượng chai nhập thực tế |
| `qty_available` | Số lượng còn tồn |
| `unit_landed_cost` | Giá vốn / chai sau phân bổ Landed Cost |
| `expiry_date` | Không áp dụng với rượu (Không hết hạn), nhưng lưu Best Drink Window (Khung uống tốt nhất) |
| `received_date` | Ngày nhập kho |
| `storage_location` | Vị trí Zone/Rack/Bin hiện tại |
| `status` | AVAILABLE / RESERVED / QUARANTINE / CONSUMED |

**FIFO Enforcement (Bắt Buộc):**
- Khi xuất kho, hệ thống tự động chọn Lot cũ nhất (Ngày nhập sớm nhất) của SKU đó
- Người xuất kho không được bỏ qua FIFO trừ khi có lý do đặc biệt (Có log + Duyệt)

> **Bảng Danh Mục Tồn Kho (Stock Lots Table)**: Đã tối ưu hóa bố cục dạng Compact Table với chiều cao dòng tối thiểu để hiển thị được nhiều hàng nhất trên 1 màn hình. Cột **Mã SKU** được tách riêng lên Cột 1 (`font-mono font-bold`), Cột **Mã Lô (Lot)** được chuyển về phía sau (`Col 4`), giúp tra cứu rượu vang và phân bổ kho nhanh chóng.

---

## 3. Nghiệp Vụ Nhập Kho (Goods Receipt — GR)

**Nguồn nhập kho:**
1. Từ **Purchase Order** (Qua hải quan xong, hàng về đến kho) — Nguồn chính
2. **Return từ Khách hàng** (Hàng bị trả lại → Nhập vào Quarantine trước)
3. **Transfer nội bộ** (Nhận hàng từ kho khác chuyển tới)
4. **Điều chỉnh tồn đầu kỳ** (Lần đầu setup ERP — Import từ Excel)

**Quy trình Nhập Kho từ PO:**
1. PO được duyệt → Shipment về đến kho → Tạo **Goods Receipt (GR)**
2. Nhân viên kho quét barcode hoặc nhập tay số lượng thực tế nhận (Có thể thiếu/thừa vs PO)
3. Ghi nhận Variances (nếu có): Thiếu hàng / Hàng bể vỡ
4. Gán vị trí lưu trữ (Bin Location) cho từng SKU trong lô
5. Confirm GR → Tồn kho tăng lên, Stock Lot được tạo, Landed Cost được lock
6. GR tự động trigger Finance tạo Journal Entry nợ vào Inventory Asset

---

## 4. Nghiệp Vụ Xuất Kho (Goods Issue — DO)

**Nguồn xuất kho:**
1. Từ **Sales Order** đã duyệt — Nguồn chính
2. **Consignment Delivery** → Hàng chuyển sang Virtual Location CONSIGNED
3. **Transfer nội bộ** (Chuyển sang kho khác)
4. **Write-off** (Bể vỡ, hỏng — Cần Approve đặc biệt)

**Luồng xuất kho từ SO:**
1. SO Approved + Allocated → Hệ thống tạo **Delivery Order (DO / Pick List)** cho thủ kho.
2. Pick List chỉ định: SKU nào, Lô nào (FIFO), Vị trí (Khu vực / Zone), số lượng bao nhiêu.
3. Thủ kho nhặt hàng trên điện thoại với giao diện mobile tối ưu (3-step wizard & compact layout).
4. Sau khi nhặt xong → In **Phiếu Xuất Kho (PDF)** — mẫu in tiêu chuẩn A4 (đồng bộ layout với Đơn Bán Hàng), kèm hàng giao cho Shipper / Khách hàng.
5. Khi giao thành công → Bấm **"Đã Giao Hàng"** (status: DELIVERED) → SO chuyển DELIVERED, Tồn kho tự động cập nhật & tự sinh bút toán Giá vốn hàng bán (COGS: Nợ 632 / Có 156).
6. **Hoàn tác Xuất Kho (Reverse DO — Admin only):** Khi hoàn tác DO, hệ thống tự động hoàn trả số lượng vào `StockLot`, chuyển DO về `CANCELLED`, hoàn về trạng thái đơn hàng `CONFIRMED` và **tự động sinh bút toán đảo Giá vốn Nợ 156 / Có 632** để cân đối sổ cái tài chính.

---

## 5. Điều Chuyển Kho (Inter-Warehouse Transfer)

Hệ thống hỗ trợ **nhiều kho** (Kho HCM, Kho HN, Kho Đà Nẵng, Showroom...). Cần chức năng điều chuyển hàng giữa các kho.

### 5.1 Khi Nào Cần Điều Chuyển?
- Cân bằng tồn kho giữa các kho
- Chuyển hàng từ kho chính → Kho vệ tinh gần khách hàng
- Cấp phát hàng từ kho nhập về → Showroom POS
- Cấp phát cho sự kiện/tasting event ở địa điểm khác

### 5.2 Luồng Nghiệp Vụ Phiếu Chuyển Kho Nội Bộ (Transfer Order Voucher & Pick List)

```
Lập Phiếu Chuyển Kho (Form Đơn Hàng)
      ↓
Trạng thái: PENDING_ACCOUNTING (Gửi Kế Toán Duyệt)
      ↓
Kế toán Phê Duyệt (Status: CONFIRMED — Sẵn sàng)
      ↓
Gợi Ý Vị Trí Nhặt Hàng (Pick List FIFO): Hệ thống tự động gợi ý Vị trí Kệ (Zone/Rack/Bin), Mã Lô, Niên Vụ & Số lượng nhặt tại Kho Đi
      ↓
Thủ Kho Xuất (Kho Đi): Bấm "In Phiếu Nhặt Hàng (Pick List A4)" & "Xuất Kho & Vận Chuyển" (Status: IN_TRANSIT, Trừ kho FIFO Kho Đi)
      ↓
Thủ Kho Nhận (Kho Đến): Kiểm hàng thực nhận & bấm "Xác Nhận Nhận Hàng" (Status: RECEIVED, Khởi tạo Stock Lot Kho Đến)
```

**Đặc tả Phiếu Chuyển Kho Nội Bộ & Luồng Nhặt Hàng:**
- **Mẫu Chứng Từ Form Đơn Hàng (`TO-YYMM-xxxx`)**: Đầy đủ thông tin Kho Đi, Kho Đến, Người Lập Phiếu, Ngày Chuyển, Lý Do Chuyển & Giá Trị Chuyển Kho (Kiểm tra tồn kho Khả dụng Real-time ở Kho Đi).
- **Gợi Ý Vị Trí Nhặt Hàng (Pick List FIFO - Kho Xuất)**: Hệ thống tự động phân tích và chỉ định Vị trí Kệ (Location Code), Mã Lô (`LotNo`), Niên vụ (`Vintage`) và Số lượng chai cần lấy tại từng ô kệ ở Kho Đi theo đúng nguyên tắc FIFO.
- **Mẫu In Giấy A4 Ký 4 Bên (`A4 Printable Voucher`)**: Tích hợp giao diện in ấn khổ A4 tiêu chuẩn chứng từ Kế toán Việt Nam, hỗ trợ 2 chế độ in:
  1. **Phiếu Chuyển Kho Nội Bộ A4**: 4 ô ký tên bằng tay ở chân phiếu dành cho: **Người Lập Phiếu**, **Kế Toán Phê Duyệt**, **Thủ Kho Xuất (Kho Đi)**, **Thủ Kho Nhận (Kho Đến)**.
  2. **Danh Sách Nhặt Hàng (Pick List A4)**: Mẫu in chuyên dụng cho thủ kho di chuyển nhặt hàng tại các kệ kho, hiển thị nổi bật Cột Vị Trí Kệ, Mã Lô, SL Cần Nhặt và ô tích xác nhận nhặt.

### 5.3 Xử Lý Tồn Kho Trong Quá Trình Transfer

| Trạng thái | Kho A | Kho B | Ghi Chú |
|---|---|---|---|
| TO Draft | Còn đủ | Chưa có | Chưa di chuyển |
| TO Confirmed (Picking) | Reserved | Chưa có | Đang chuẩn bị |
| IN_TRANSIT | Đã xuất (-) | IN_TRANSIT slot | Đang trên đường |
| Received | Đã xuất (-) | Nhập kho (+) | Hoàn tất |
| Partial receive | Đã xuất (-) | Nhập 1 phần | Phần thiếu → Quarantine TO |

### 5.4 Database Design (Transfer)

```
TransferOrder {
  id, to_no (unique), from_warehouse_id, to_warehouse_id,
  requested_by, approved_by, status
  (DRAFT | CONFIRMED | IN_TRANSIT | RECEIVED | CANCELLED),
  created_at, shipped_at, received_at
}

TransferOrderLine {
  id, to_id, product_id, lot_id,
  from_location_id, to_location_id (planned),
  qty_requested, qty_shipped, qty_received
}

StockMove {
  id, reference_type (GR|DO|TRANSFER|COUNT_ADJ|WRITE_OFF),
  reference_id, product_id, lot_id,
  from_location_id, to_location_id,
  qty, moved_at, moved_by
}
```

> `StockMove` là bảng audit log toàn bộ di chuyển tồn kho — Truy xuất history đầy đủ.

---

## 6. Quản Lý Hàng Lỗi / Quarantine

Khu riêng biệt (Quarantine Zone) để cách ly hàng chờ xử lý:

**Nguồn vào Quarantine:**
- Phát hiện bể vỡ lúc nhập kho (GR)
- Hàng khách hàng trả về (Chất lượng không đạt)
- Shipper báo cáo bể vỡ khi giao (từ TRS module)

**Xử lý Quarantine:**
| Quyết định | Hành động |
|---|---|
| Hàng vẫn tốt | Chuyển về kho thường (Transfer to Storage) |
| Hàng hỏng hoàn toàn | Write-off (Xóa tồn, ghi vào Chi phí tổn thất) |
| Hàng bể do vận chuyển | Lập hồ sơ bảo hiểm (Link Insurance Claim) |
| Trả lại cho NCC | Tạo Return PO |

---

## 6. Kiểm Kê Kho Nâng Cao (Stock Count System)

Hệ thống kiểm kê kho bãi đa chế độ, hỗ trợ đếm bằng điện thoại theo vị trí, kiểm kê mù, phân công nhân sự và in Biên bản kiểm kê chuẩn kế toán có chữ ký 3 bên.

### 6.1 4 Chế Độ Phạm Vi Kiểm Kê (Scope Types)
1. 📦 **Kiểm kê Full Kho (`FULL_WAREHOUSE`):** Quét toàn bộ sản phẩm và tất cả vị trí trong kho (kiểm kê tổng thể cuối kỳ).
2. 🔄 **Cycle Count (Kiểm kê chu kỳ):** Chọn cụ thể theo **Vị trí (Zone/Rack)** hoặc **Nhóm danh mục sản phẩm (Rượu vang đỏ/trắng/loại rượu)**.
3. ⚡ **Kiểm kê mã có giao dịch (`TRANSACTED_ITEMS`):** Tự động lọc các mã SKU có phát sinh Giao dịch Nhập (GR), Xuất (DO), hoặc Điều chuyển trong N ngày gần nhất (mặc định 30 ngày).
4. 🚨 **Kiểm kê Đột xuất (`SPOT_COUNT`):** Cho phép Ban Quản Lý / Kiểm toán chọn cụ thể **Danh sách Mã SKU bất kỳ** HOẶC **Khu vực/Kệ cụ thể** để phát lệnh kiểm kê tức thì không báo trước.

### 6.2 Bộ Tính Năng Kiểm Kê Nâng Cao
- **Trung Tâm Điều Hành Kiểm Kê Dành Cho Lead / Trưởng Kho (Live Lead Command Center Dashboard):** Tích hợp chế độ `🔴 LIVE SYNC (5s)` tự động tải dữ liệu thời gian thực. Bảng điền đóng vai trò Bảng chỉ huy giúp Trưởng kho / Lead theo dõi tiến độ đếm thực tế của từng nhân viên trên điện thoại (tỷ lệ %, số chai khớp, số chai lệch), lọc đa tiêu chí theo **Vị trí kệ / Nhân viên phụ trách / Trạng thái chênh lệch**, và ghi nhận vết thời gian thực đếm (`countedAt` timestamp audit trail).
- **Linh hoạt Giao diện Đếm Điện Thoại & Bảng Điền Trực Tiếp (Mobile Counter ↔ Interactive Grid Table):** Cho phép người dùng chuyển đổi linh hoạt 2 chiều giữa chế độ đếm tập trung di động (`MobileLocationCounter`) và chế độ Bảng Điền trực tiếp kiểu Bảng tính Spreadsheet (`StockCountTableModal`).
- **Bộ Lọc Vị Trí / Kệ Kho (Location/Zone Dropdown Filter):** Cho phép chọn lọc nhanh vị trí kệ kho (`Khu A - Kệ 01`, `Khu B - Kệ 02`...) ngay trên Bảng Điền để kho tập trung kiểm kê và chốt chênh lệch theo từng khu vực cụ thể.
- **Chèn thêm Mã SKU / Vintage ngoài danh sách (`+ Chèn Mã Bổ Sung`):** Cho phép nhân viên kiểm kê ghi nhận trực tiếp các mã sản phẩm hoặc niên vụ (Vintage) phát sinh thực tế trên kệ nhưng chưa được tạo sẵn trong danh sách kiểm kê ban đầu.
- **Kiểm kê theo Niên Vụ (Vintage Tracking):** Đơn vị sản phẩm kiểm kê hiển thị rõ ràng Niên vụ (`vintage`: 2018, 2019, NV...), đảm bảo việc kiểm đếm chính xác từng lô rượu theo niên vụ xuất xứ.
- **Quy đổi Thùng + Chai Lẻ Tự Động (Case & Loose Bottle Conversion):** Tự động quy đổi số lượng tổng chai sang `X thùng + Y chai lẻ` dựa theo quy cách đóng thùng (`unitsPerCase`, mặc định 6 chai/thùng). Ví dụ: `62 chai` quy cách 6 chai/thùng $\rightarrow$ hiển thị `10 thùng 2 chai lẻ`.
- **Giao diện Đếm Di Động 2 Ô Nhập Thùng + Chai (Mobile Location Counter):** Loại bỏ giao diện quét barcode rườm rà; thay bằng 2 ô nhập trực tiếp `📦 Số Thùng` và `🍾 Chai Lẻ` cảm ứng nhanh, tự động cộng tổng chai thời gian thực.
- **Chế độ Kiểm kê Mù (Blind Count Option):** Admin bật tùy chọn "Giấu tồn sổ sách" khi giao việc. Nhân viên cầm điện thoại đếm sẽ KHÔNG nhìn thấy tồn sổ sách (`qtySystem`), bắt buộc đếm thực tế 100% để chống chép lại số liệu.
- **Phân công Nhân sự (Staff Assignment):** Gán nhân viên chịu trách nhiệm kiểm kê (`assignedTo`). Nhân viên mở điện thoại thấy ngay phiếu cần làm tại tab "Phân công cho tôi".
- **Phân loại & Chụp ảnh Bằng chứng:** Ghi nhận nguyên nhân chênh lệch (`VỠ_HỎNG`, `NHẦM_MÃ`, `XUẤT_CHƯA_GHI_SỔ`, `THẤT_THOÁT`...) và chụp ảnh bằng chứng bằng Camera.
- **Tự động Khởi tạo Phiếu Điều Chỉnh Kế Toán (Auto Stock Adjustment Voucher):** Khi duyệt phiếu kiểm kê (`APPROVED`), hệ thống tự động tính giá trị chênh lệch (VND) và sinh Bút toán kế toán điều chỉnh tồn kho (Nợ 632 / Có 156 hoặc Nợ 1388 / Có 156).
- **In Biên bản kiểm kê chuẩn A4 Kế toán theo Tên Pháp Nhân Kho (Printable Audit Report):** Mẫu Biên bản kiểm kê A4 tiêu chuẩn Kế toán Việt Nam, tự động truy xuất Tên Pháp Nhân (`legalEntityName`), Mã số thuế (`legalEntityTaxId`) và Địa chỉ từ cấu hình Kho Hàng. Đơn giản hóa bỏ toàn bộ chữ ký điện tử rườm rà, thay bằng 4 khung chữ ký đóng dấu bằng tay mực thực tế (*Người lập phiếu*, *Người kiểm kê*, *Thủ kho / BQL Kho*, *Kế toán kho / Giám đốc*).

---

## 7. Dashboard Kho (Warehouse Dashboard)

Giao diện tổng quan cho Quản lý Kho:
- **Tổng tồn kho:** Số chai / Số thùng / Giá trị VND (từ Landed Cost)
- **Heatmap vị trí:** Màu sắc thể hiện ô kệ đang trống / đang có hàng / quá tải
- **Slow-moving Alert:** SKU không xuất trong > 180 ngày
- **Sắp về (In-transit):** Từ AGN module — Container nào sắp về, số lượng dự kiến
- **Quarantine List:** Hàng đang chờ xử lý

---

## 10. Sơ Đồ Kho 2D — Visual Warehouse Map

> **Tab "Sơ Đồ Kho" trong module WMS** — Bản đồ 2D trực quan, hỗ trợ kéo thả sắp xếp (Admin only).

### 10.1 Tính Năng

| Tính năng | Mô tả |
|---|---|
| **Canvas 2D** | Grid background, pan (kéo nền), scroll wheel zoom (0.3x–3x), reset view |
| **Location blocks** | Hiển thị locationCode, occupancy bar, màu theo mức chiếm dụng (xanh→vàng→đỏ) |
| **Zone labels** | Label tự động hiển thị tên Zone phía trên nhóm locations |
| **Tìm sản phẩm** | Gõ SKU/tên → highlight vị trí trên bản đồ (pulse glow animation) + hiển thị kết quả |
| **Chi tiết vị trí** | Click location → panel phải hiển thị: Zone/Rack/Bin, loại, chiếm dụng %, danh sách SP |
| **Edit mode (Admin)** | CEO/Thủ kho bật "Chỉnh Sửa" → kéo thả từng location block trên canvas |
| **Auto Grid** | Tự động sắp xếp locations theo lưới nhóm theo Zone (6 cột/zone) |
| **Batch Save** | Lưu toàn bộ vị trí layout cùng lúc (transaction) |
| **Chú thích** | Legend: 5 mức chiếm dụng (Trống/Thấp/TB/Cao/Đầy) + Zone colors |

### 10.2 Phân Quyền

| Vai trò | Xem bản đồ | Tìm SP | Kéo thả / Lưu layout |
|---|---|---|---|
| CEO | ✅ | ✅ | ✅ |
| Thủ kho | ✅ | ✅ | ✅ |
| Các role khác | ✅ | ✅ | ❌ (ẩn nút Chỉnh Sửa) |

### 10.3 Backend (actions-map.ts)

```
getWarehouseMapData(warehouseId)         → MapWarehouse with locations + stock occupancy
updateLocationPosition(locationId, pos)  → Admin-only single location update
saveWarehouseLayout(warehouseId, layouts) → Admin-only batch position save (transaction)
autoLayoutWarehouse(warehouseId)          → Auto-grid by zone (6 cols, padding, zone gap)
searchProductLocations(warehouseId, term) → Find product → return locationIds for highlight
```

---

## 11. Sổ Nhập Xuất Tồn Kho — Warehouse Inventory Summary & Detail Ledger (NXT)

> **Tab "Nhập Xuất Tồn" trong module WMS** — Báo cáo Nhập - Xuất - Tồn toàn bộ kho hàng với khả năng lọc theo khoảng thời gian và **Drill-down Sổ Chi Tiết**.

### 11.1 Tính Năng Báo Cáo Tổng Hợp Kho (Summary View)

| Tính năng | Mô tả |
|---|---|
| **Bộ lọc khoảng thời gian** | Từ ngày → Đến ngày với các preset nhanh: *Tháng này*, *Tháng trước*, *Quý này*, *Năm nay*, *Tùy chỉnh* |
| **Bộ lọc kho hàng** | Tất cả các kho hoặc chọn 1 kho cụ thể |
| **Bảng tổng hợp cả kho** | Hiển thị tất cả SKU với các cột: Mã SKU, Tên SP, ĐVT, **Tồn Đầu Kỳ** (SL & Giá trị), **Nhập Trong Kỳ** (SL & Giá trị), **Xuất Trong Kỳ** (SL & Giá trị), **Tồn Cuối Kỳ** (SL & Giá trị), **Đơn Giá Vốn BK (Landed Cost)** |
| **Thẻ KPI tổng quan** | 5 chỉ số: *Tổng SKU*, *Tồn Đầu Kỳ*, *Tổng Nhập Trong Kỳ*, *Tổng Xuất Trong Kỳ*, *Tồn Cuối Kỳ* |
| **Lọc phát sinh** | Option *Chỉ hiện sản phẩm có tồn kho hoặc có phát sinh* để tối ưu báo cáo |
| **Export CSV** | Xuất báo cáo Nhập Xuất Tồn tổng hợp 13 cột với mã định dạng UTF-8 BOM cho Excel |

### 11.2 Tính Năng Sổ Chi Tiết Mã Sản Phẩm (Drill-Down Detail View)

| Tính năng | Mô tả |
|---|---|
| **Kích hoạt Drill-down** | Click vào mã SKU hoặc nút *Sổ Chi Tiết* ở bất kỳ dòng nào trong Bảng Tổng Hợp |
| **Giao diện chi tiết** | Banner thông tin sản phẩm (SKU, tên, loại rượu, xuất xứ, tồn kho hiện tại) + Nút `← Quay lại Bảng Tổng Hợp` |
| **Mốc Tồn Đầu Kỳ** | Dòng hiển thị số dư Tồn Đầu Kỳ chuẩn xác tại mốc ngày `dateFrom` |
| **Sổ chứng từ lũy kế** | Danh sách phiếu GR (nhập) / DO (xuất) trong khoảng thời gian, tự động tính **Tồn Lũy Kế (Running Balance)** từng dòng |
| **Phân bổ vị trí kho** | Panel bên phải hiển thị chi tiết các Lô hàng (`StockLot`) & Vị trí (`LocationCode`) đang lưu trữ thực tế |

### 11.3 Backend (`actions-nxt.ts`)

```typescript
getWarehouseNXTReport(filters)           → { items: WarehouseNXTItem[], summary: WarehouseNXTSummary }
getStockMovements(filters)                → { movements: StockMovementRow[], summary: NXTSummary } (Tính openingBalance chuẩn & running balance)
getProductSearchOptions(search?)          → ProductOption[] (SKU, name)
getProductStockByLocation(productId)      → Current lots with location details
```

---

## 12. Quản Lý Tồn Kho Hàng Mẫu — Sample Wine Inventory

> **Tab "🍷 Quản Lý Hàng Mẫu" trong module WMS** — Quản lý hàng mẫu riêng biệt không bán hàng thương mại, hỗ trợ hàng có SKU / chưa có SKU, hàng chính ngạch và tiểu ngạch.

### 12.1 Đặc Điểm Tính Năng
- **Tách biệt 100% kho bán hàng**: Dữ liệu lưu tại model `SampleProduct` và `SampleTransaction`, không bị xuất bán nhầm.
- **Hỗ trợ 2 dạng mẫu**: Đã có mã SKU hệ thống OR Chưa có SKU (tự nhập tên rượu mẫu).
- **Phân loại nguồn ngạch**: `Chính Ngạch` (FORMAL) vs `Tiểu Ngạch / Xách Tay` (INFORMAL).
- **Nhật ký xuất mẫu theo mục đích**: *Thử rượu/Sommelier tasting*, *Tặng khách VIP*, *Marketing/Media*, *Kiểm định chất lượng*, *Hỏng/Hủy*.

### 12.2 Backend (`actions-sample.ts`)
```typescript
getSampleProducts(filters)       → SampleProductItem[]
getSampleInventoryStats()        → SampleInventoryStats (5 KPI stats)
createSampleProduct(data)        → Create sample item & initial inbound receipt
createSampleTransaction(data)    → Create SMR/SMO/SMA doc & update qtyOnHand
getSampleTransactions(filters)   → SampleTransactionItem[]
```

## 8. Database Design

```
Warehouse → Zone → Rack → Bin (Location)
StockLot { lot_no, sku, shipment_id, qty, unit_cost, received_date, location_id, vintage, status }
StockMove { lot_id, from_location, to_location, qty, move_type, reference_id, created_at }
GoodsReceipt { gr_no, po_id, warehouse_id, status, confirmed_by, confirmed_at }
GoodsReceiptLine { gr_id, sku, lot_id, qty_expected, qty_received, variance }
DeliveryOrder { do_no, so_id, warehouse_id, status }
DeliveryOrderLine { do_id, sku, lot_id, location_id, qty_picked, qty_shipped }
PickList { do_id, assigned_to, status }
PickListLine { pick_id, sku, lot_id, bin_location, qty }
StockCountSession { zone_id, type, status, started_at, completed_at }
StockCountLine { session_id, sku, loc_id, qty_system, qty_actual, variance, assigned_to_id }
TransferOrder { from_wh_id, to_wh_id, status, shipped_at, received_at }
TransferOrderLine { to_id, product_id, lot_id, qty_requested, qty_shipped }
StockMove { reference_type, reference_id, product_id, lot_id, from_loc, to_loc, qty }
```

---

## 9. Quét Mã Bằng Camera Điện Thoại (Mobile Scanner)

> **Thủ kho dùng điện thoại cá nhân** — Không cần mua máy quét chuyên dụng đắt tiền.

### 9.1 Công Nghệ

Ứng dụng web (Next.js) chạy như **PWA (Progressive Web App)**. Trên điện thoại:

```
Thủ kho mở trình duyệt (Chrome/Safari) → Vào đường dẫn kho
→ "Thêm vào màn hình chính" (Add to Home Screen)
→ Chạy như app thực sự, có thể dùng offline
→ Click "Quét mã" → Camera tự bật (Không cần cài app)
```

**Thư viện sử dụng:** [`html5-qrcode`](https://github.com/mebjas/html5-qrcode) (hoặc `@zxing/browser`)
- Hỗ trợ: QR Code, EAN-13, Code 128, Code 39
- Hoạt động: iPhone (Safari) ✅, Android (Chrome) ✅
- Không cần Internet nếu dùng Supabase local cache

### 9.2 Các Nghiệp Vụ Hỗ Trợ Quét Camera

| Nghiệp Vụ | Scan gì | Kết quả |
|---|---|---|
| **Nhập kho (GR)** | Barcode EAN chai | Auto điền SKU, số lượng |
| **Xác nhận vị trí** | QR Bin Location | Gán lot vào đúng Bin A-01-02 |
| **Xuất kho (Picking)** | QR Lot hoặc EAN | Xác nhận đúng hàng/lot cần lấy |
| **Kiểm kê** | QR Bin → QR Lot | Đếm từng ô theo thứ tự |
| **Điều chuyển kho** | QR Lot | Confirm hàng đúng khi bàn giao |
| **POS Showroom** | QR/EAN chai | Add vào giỏ hàng bán |
| **Truy xuất** | QR bất kỳ | Xem thông tin lot/chai ngay |

### 9.3 Giao Diện Mobile WMS

```
┌──────────────────────────────┐
│ 🏭 KHO HCM — Thủ kho: Tuấn  │
├──────────────────────────────┤
│  [📷 QUÉT MÃ NHANH]          │
│                              │
│  ┌──────────────────────┐    │
│  │                      │    │
│  │   📷 Camera Live     │    │
│  │   ┌──────────┐       │    │
│  │   │ aim here │       │    │
│  │   └──────────┘       │    │
│  │                      │    │
│  └──────────────────────┘    │
│                              │
│  Kết quả: LOT-2403-0042      │
│  Château Pétrus 2018         │
│  Bin: A-02-03 | Còn: 48 chai │
│                              │
│  [NHẬP KHO] [XUẤT KHO] [XEM] │
└──────────────────────────────┘
```

### 9.4 Luồng Nhập Kho Bằng Điện Thoại

```
1. Mở app → Chọn "Nhập Kho" → Chọn GR #
2. Scan EAN chai đầu tiên → SKU tự điền
3. Nhập số lượng thực nhận (bàn phím số lớn, dễ bấm)
4. Scan QR Bin Location để gán vị trí
5. Lặp lại cho SKU tiếp theo
6. Confirm GR → Đồng bộ lên server
```

### 9.5 Offline Support (Hoạt Động Không Có Internet)

```
WMS Mobile App (PWA):
  - Cache danh sách GR đang mở (Service Worker)
  - Lưu thao tác scan offline → IndexedDB
  - Khi có kết nối → Auto sync lên Supabase
```
Cần thiết vì kho có thể có vùng mù sóng.

*Last updated: 2026-03-04 | Wine ERP v4.0*

---

## 12. Implementation Status (Trạng Thái Triển Khai)

> Cập nhật 10/03/2026 — **Hoàn thiện 100% + 2 tính năng mới (NXT, 2D Map)**

### ✅ Core Features (Đã triển khai từ trước)

| Tính năng | File code | Ghi chú |
|---|---|---|
| Warehouse CRUD | `warehouse/actions.ts` | Tạo, sửa, xóa warehouses + locations |
| Location Heatmap | `getLocationHeatmap` | Occupancy per zone |
| Stock Inventory | `getStockInventory` | Lot view: filter by warehouse, wine type, status |
| Goods Receipt | `createGoodsReceipt`, `confirmGoodsReceipt` | GR từ PO → StockLot auto-create |
| Delivery Order | `createDeliveryOrder`, `confirmDeliveryOrder` | DO từ SO → FIFO pick + auto COGS journal |
| **Stock Transfer** | `transferStock` | Chuyển lot giữa locations |
| **Cycle Count** | Full cycle: `create → record → complete → adjust` | Session-based count with variance |
| **FIFO Picking** | `pickByFIFO` | Auto-select oldest lots |
| **Quarantine** | `moveToQuarantine`, `releaseFromQuarantine` | Cách ly + restore/write-off với approval |
| **Write-Off** | `writeOffStock` | Ghi nhận hao hụt → auto DR 811 / CR 156 |
| **Stock Adjustment** | `adjustStockFromCount` | From cycle count variance |
| **Barcode Scanner** | `scanBarcode` | Scan PRODUCT / LOT / LOCATION |
| **Quick Stock Check** | `quickStockCheck` | Product → all lots + locations + days in stock |
| **GR Variance Report** | `getGRVarianceReport` | PO ordered vs GR received per-product |
| WMS Full Stats | `getWMSFullStats` | 9 KPIs: qty, value, SKUs, quarantine, low-stock alerts |

### ✅ Deep Dive Enhancements (08/03/2026 — 32 gaps xử lý)

#### Phase 1: WMS Dashboard & Stock Table

| Tính năng | File | Ghi chú |
|---|---|---|
| 6 enhanced stat cards | `WarehouseClient.tsx`, `getWMSStats` | +Giá trị kho VND, cảnh báo tồn thấp, hàng nằm lâu >180d |
| Vintage column | `StockTable` component | Hiện năm sản xuất hoặc "NV" |
| Days-in-Stock badge | `DaysInStockBadge` | <90d xanh, 90-180d vàng, >180d đỏ |
| Lot Value column | `StockTable` | qty × unitLandedCost (VND) |
| Sortable stock table | All column headers | Click to sort asc/desc |
| 30+ country flags | `COUNTRY_FLAGS` map | FR, IT, ES, US, AU, AR, CL, ZA... |
| Fixed LOT_STATUS colors | `LOT_STATUS` config | 5 unique: AVAILABLE(xanh), RESERVED(xanh dương), QUARANTINE(vàng), CONSUMED(xám), DAMAGED(đỏ) |
| Warehouse value display | `WarehouseCard` | Tổng giá trị tồn VND trên mỗi card |
| Quarantine auto-load | `handleTabChange` | Tự load data khi mở tab Cách Ly |
| Wine type +2 | Filter dropdown | +Fortified, +Dessert |
| **CSV Export** | `WarehouseClient.tsx` | Nút "↓ Export CSV" — 10 cột, BOM cho Excel |

#### Phase 2: GR & DO Detail Drawers

| Tính năng | File | Ghi chú |
|---|---|---|
| GR confirmer columns | `GoodsReceiptTab.tsx` | +Người XN, +Ngày XN trên bảng |
| GR detail drawer | `getGRDetail` + tab UI | Click row → drawer chi tiết: lines + variance |
| DO detail drawer | `getDODetail` + tab UI | Click row → drawer: lots picked + qty shipped |
| Create GR drawer | `CreateGRDrawer` | PO selection + qty + location input |
| Create DO drawer | `CreateDODrawer` | SO selection + lot + qty input |

#### Phase 3: Transfer Order Improvements

| Tính năng | File | Ghi chú |
|---|---|---|
| Preserve unitLandedCost | `transfers/actions.ts` | 🔥 Critical fix — giá vốn không bị mất khi transfer |
| Transfer detail drawer | `getTransferDetail` + UI | Click row → lines with SKU, qty transferred/received |
| Cancel transfer | `cancelTransferOrder` | Hủy lệnh DRAFT |
| TO number format | `createTransferOrder` | TO-YYMM-NNNN (thay vì TO-000001) |

#### Phase 4: Wine Intelligence

| Tính năng | File | Ghi chú |
|---|---|---|
| Aging color code | `DaysInStockBadge` | Tự đổi màu theo ngày tồn kho |
| Slow-moving stat | `getWMSStats` | slowMovingCount (>180 days) |
| Low-stock alert | `getWMSStats` | lowStockCount (<12 chai/SKU) |

#### Technical Fixes

| Fix | Chi tiết |
|---|---|
| **Modular code split** | `actions.ts` → tách ra `actions-gr.ts` (~250 dòng), `actions-do.ts` (~200 dòng) |
| **Atomic numbering** | GR/DO/Lot numbers: `findFirst({orderBy: 'desc'})` thay `count()+1` — no collision |
| **Session auth** | `confirmGoodsReceipt` + `confirmDeliveryOrder` dùng `getCurrentUser()` thay hardcode `'user-admin'` |
| **Edit/Delete warehouse** | `editWarehouse`, `deleteWarehouse` actions (kiểm tra location trước khi xóa) |

#### Phase 5: Stock Movement Report & 2D Map (10/03/2026)

| Tính năng | File | Ghi chú |
|---|---|---|
| **Schema: Location posX/posY/width/height** | `schema.prisma` | Tọa độ 2D cho visual warehouse map |
| **Tab Nhập Xuất Tồn (NXT)** | `StockMovementTab.tsx`, `actions-nxt.ts` | Search SP → timeline GR/DO + running balance + summary + CSV export |
| **Tab Sơ Đồ Kho 2D** | `WarehouseMapTab.tsx`, `actions-map.ts` | Canvas pan/zoom, drag-drop (admin), occupancy heatmap, product search highlight |
| **Product Search Options** | `getProductSearchOptions()` | Cached search by SKU/name for NXT tab |
| **Stock Movement Query** | `getStockMovements()` | GR lines (nhập) + DO lines (xuất) → running balance |
| **Warehouse Map Data** | `getWarehouseMapData()` | Locations + stock occupancy per location |
| **Batch Layout Save** | `saveWarehouseLayout()` | Admin-only batch position update (transaction) |
| **Auto Grid Layout** | `autoLayoutWarehouse()` | Auto-arrange by zone in 6-column grid |
| **Product Location Search** | `searchProductLocations()` | SKU → highlighted locations on map |
| **isAdmin prop** | `page.tsx`, `WarehouseClient.tsx` | CEO/THU_KHO role check for map edit controls |

#### Phase 6: Professional Floor Plan Editor (10/03/2026)

| Tính năng | File | Ghi chú |
|---|---|---|
| **Schema: Warehouse layoutConfig** | `schema.prisma` | JSON field lưu walls/doors/labels |
| **Light canvas with dot grid** | `WarehouseMapTab.tsx` | White background, radial-gradient dots, professional look |
| **Left toolbar (5 tools)** | `WarehouseMapTab.tsx` | Chọn, Tường, Cửa, Nhãn, Xóa — giống Figma |
| **Wall drawing** | SVG `<line>` elements | Click-to-click vẽ tường, snap-to-grid, preview line |
| **Door placement** | SVG `<rect>` + arc | Click đặt cửa với biểu tượng arc |
| **Text labels** | SVG `<text>` | Prompt nhập text, tự do đặt vị trí |
| **Eraser tool** | Distance-based detection | Click gần element → xóa (threshold 15px) |
| **Layout config persistence** | `getWarehouseLayoutConfig()`, `saveWarehouseLayoutConfig()` | Lưu/tải walls+doors+labels từ DB |
| **Zone badges** | Colored badges + dashed border | Badge "ZONE A" với nền dashed bao quanh khu vực |
| **Occupancy color system** | 5-level heatmap | Trống (gray), Thấp (blue), TB (green), Cao (amber), Đầy (red) |

#### Bug Fixes (10/03/2026)

| Fix | Chi tiết |
|---|---|
| **Prisma nested include crash** | `getWarehouses()` + `getWarehouseMapData()` — nested `stockLots` include gây `column (not available)` error trên Vercel. Rewrite thành separate queries |
| **Missing DB columns** | `prisma db push` chạy trên production để sync `posX/posY/width/height` columns |
| **Silent error swallowing** | `.catch(() => [])` trong `page.tsx` nuốt mất error. Thay bằng try/catch + console.error |

#### Phase 7: Unified WMS Command Center & Tab Restructuring (08/08/2026)

| Tính năng | File | Ghi chú |
|---|---|---|
| **Bảng Chức Năng 9 Thẻ Trực Quan** | `WarehouseClient.tsx` | View Toggle (`grid` vs `workspace`), 9 Feature Cards (Tồn Kho, GR, DO, Chuyển Kho, Kiểm Kê, Sơ Đồ Kho 2D, Vị Trí, Cách Ly, Báo Cáo NXT) |
| **Integrate Stock Transfers (Chuyển Kho)** | `TransfersTab.tsx` | Wrap `../transfers/actions` vào phân hệ Kho Hàng, giao diện Light Theme |
| **Integrate Stock Count (Kiểm Kê Kho)** | `StockCountTab.tsx` | Wrap `../stock-count/actions` + quét mã vạch Barcode di động vào phân hệ Kho Hàng |
| **Tối ưu thanh Header WMS** | `WarehouseClient.tsx` | Đưa dropdown chọn kho & nút `⚙️ Cấu Hình Kho` lên hàng header trên cùng bên cạnh `+ Tạo Kho Mới`. Bỏ hoàn toàn thanh bên dưới và nút quay lại thừa |
| **Tự động mặc định kho theo Pháp nhân** | `SalesClient.tsx`, `DeliveryOrderTab.tsx` | Tự động chọn kho mặc định của Pháp nhân sở hữu đơn bán hàng, vô hiệu hóa kho chỉ điều chuyển (`allowSales: false`) khỏi đơn bán hàng để tránh chọn nhầm |
| **Tự động mặc định kho theo Pháp nhân** | `SalesClient.tsx`, `DeliveryOrderTab.tsx` | Tự động chọn kho mặc định của Pháp nhân sở hữu đơn bán hàng, vô hiệu hóa kho chỉ điều chuyển (`allowSales: false`) khỏi đơn bán hàng để tránh chọn nhầm |
| **Tự động tách vị trí nhặt hàng Multi-Location FIFO** | `DeliveryOrderTab.tsx`, `actions-do.ts` | Tự động phân bổ số lượng nhặt tách ra nhiều vị trí/lô theo thứ tự FIFO (VD: nhặt 1 chai ở kệ A, 1 chai ở kệ B cho đủ 2 chai đơn hàng). Bỏ nút phân bổ thừa và hỗ trợ thêm/xóa dòng tách vị trí nhặt linh hoạt |
| **Phân quyền Cấu hình Kho về Cài đặt & RBAC System Admin** | `SettingsClient.tsx`, `WarehouseClient.tsx` | Đưa toàn bộ cấu hình kho (Pháp nhân quản lý, Cho phép Bán Hàng `allowSales`, Cho phép Điều Chuyển `allowTransfer`, Kho Mặc Định `isDefault`) về mục Cài Đặt hệ thống & RBAC (`SYS:ADMIN`). Gỡ nút Cấu Hình Kho khỏi màn hình WMS để tránh thủ kho chọn nhầm |
| **Tái thiết kế Sơ Đồ Kho 2D Light Theme & Sửa Lỗi Kiểm Kê Kho** | `WarehouseMapTab.tsx`, `actions.ts`, `schema.prisma` | Bổ sung Khung Ranh Giới Tổng Thể Mặt Bằng Kho (`24m x 16m`). Sửa triệt để lỗi tạo đợt kiểm kê kho (`Invalid value for argument type. Expected CountType`): bổ sung `FULL`, `SPOT` vào `CountType` enum trong Prisma schema, đồng thời mapping tương thích an toàn cho cả `FULL_PHYSICAL`, `FULL`, `CYCLE`, `SPOT` |

#### Phase 8: Báo Cáo Nhập Xuất Tồn & Lọc Đồng Bộ Kho Hàng (13/08/2026)

| Tính năng / Sửa lỗi | File | Chi tiết |
|---|---|---|
| **Khắc phục Tồn Đầu Kỳ = 0** | `actions-nxt.ts` | Tính nguồn nhập tồn đầu kỳ từ `StockLot` (`receivedDate < fromDate`, loại trừ lô điều chuyển `TRF-`) kết hợp `GoodsReceiptLine`. Sửa dứt điểm lỗi tồn đầu kỳ = 0 làm tồn cuối kỳ bị âm |
| **Loại bỏ luân chuyển nội bộ khi xem Tất cả các kho** | `actions-nxt.ts` | Chỉ cộng `TRANSFER_IN` / `TRANSFER_OUT` vào tổng nhập/xuất khi lọc một kho cụ thể. Ở chế độ xem "Tất cả các kho", các giao dịch điều chuyển nội bộ giữa 2 kho của công ty được ghi nhận net effect = 0, tránh thổi phồng tổng nhập/xuất công ty |
| **Đồng bộ Dropdown chọn kho ở Header** | `WarehouseClient.tsx`, `StockMovementTab.tsx` | Truyền prop `selectedWarehouseId` từ header `WarehouseClient` xuống `StockMovementTab` và tự động re-query số liệu khi chọn kho từ header |
| **Thẻ Cảnh Báo Nhắc Đơn Hàng Mới Tự Động (Web Notification & Audio Alert)** | `web-notifications.ts`, `WarehouseClient.tsx`, `actions.ts` | Bổ sung cơ chế phát âm thanh Web Audio API (Chime D5->A5->D6) + Nảy ô thông báo nổi Desktop (`Notification API`) ngoài màn hình máy tính khi có đơn bán hàng mới cần nhặt. Thêm nút bật/tắt `🔊 Bật Nhắc Đơn` trên thanh Header WMS |
| **Đồng bộ chuẩn Giao diện & Font chữ Kiểm Kê Kho theo chuẩn Đơn Bán Hàng** | `StockCountClient.tsx` | Chuẩn hóa toàn bộ layout, font chữ, mã phiếu (font-mono cyan blue), thanh chỉ số quick stats 1 dòng, tab bộ lọc số lượng badge pill, và các nút hành động (👁️ Xem, ⚡ Bắt Đầu, 🖨️ In) đồng bộ 100% với giao diện màn hình Đơn Bán Hàng |

#### Phase 9: Goods Receipt (GR) Location Dropdown & Vintage Support (18/08/2026)

| Tính năng | File | Chi tiết |
|---|---|---|
| **Vị Trí Kho Dropdown theo Kho Nhận** | `GoodsReceiptTab.tsx`, `actions.ts`, `actions-gr.ts` | Khi chọn kho nhận, hệ thống tự động tải danh sách vị trí kho khả dụng (`Location` / Zone - Kệ - Ô) và hiển thị dạng dropdown chọn nhanh thay vì nhập tay text tự do |
| **Hỗ trợ Niên Vụ (Vintage) khi Nhập Kho** | `validations.ts`, `actions.ts`, `actions-gr.ts`, `GoodsReceiptTab.tsx` | Bổ sung trường Niên Vụ (`vintage`, VD: `2020`, `2021`, `NV`) cho từng dòng sản phẩm khi tạo phiếu Goods Receipt, lưu trực tiếp vào bản ghi `StockLot` tương ứng và hiển thị trên bảng chi tiết GR |

### Chi tiết GR Variance Report

```
getGRVarianceReport(filters?: { warehouseId?, dateFrom?, dateTo? })
→ Per GR: grNo, poNo, supplier, lines[]
→ Per line: product, qtyOrdered, qtyReceived, variance, variancePct
→ Status: OK | SHORT | SURPLUS
→ hasIssues flag cho quick filter
```

*Last updated: 2026-08-18 | Wine ERP v10.3 — Goods Receipt Location Dropdown & Vintage Lot Support*


