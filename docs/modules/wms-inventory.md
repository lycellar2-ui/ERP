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
1. SO Approved + Allocated → Hệ thống tạo **Pick List** cho thủ kho
2. Pick List chỉ định: SKU nào, Lô nào (FIFO), Vị trí nào, số lượng bao nhiêu
3. Thủ kho đi nhặt hàng, quét Barcode tại Bin Location để xác nhận
4. Sau khi pick xong → **Pack & Ship**: In tem, đóng thùng, giao cho TRS module
5. Confirm DO → Tồn kho giảm, Finance tạo COGS entry

---

## 5. Điều Chuyển Kho (Inter-Warehouse Transfer)

Hệ thống hỗ trợ **nhiều kho** (Kho HCM, Kho HN, Kho Đà Nẵng, Showroom...). Cần chức năng điều chuyển hàng giữa các kho.

### 5.1 Khi Nào Cần Điều Chuyển?
- Cân bằng tồn kho giữa các kho
- Chuyển hàng từ kho chính → Kho vệ tinh gần khách hàng
- Cấp phát hàng từ kho nhập về → Showroom POS
- Cấp phát cho sự kiện/tasting event ở địa điểm khác

### 5.2 Luồng Nghiệp Vụ Transfer Order (TO)

```
Yêu cầu Transfer
      ↓
Tạo Transfer Order (TO) — Từ kho A → Đến kho B
      ↓
Phê duyệt (nếu số lượng lớn)
      ↓
Kho A: PICK hàng → Đóng thùng → "Xuất điều chuyển"
      ↓
Trạng thái: Stock Lot chuyển sang IN_TRANSIT (Virtual Location)
      ↓
Kho B: Nhận hàng → Kiểm tra số lượng / tình trạng
      ↓
Confirm nhận → Stock Lot cập nhật location sang Kho B
```

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

## 6. Kiểm Kê (Stock Count / Cycle Count)

**2 loại kiểm kê:**
- **Full Physical Count:** Dừng xuất nhập, kiểm toàn bộ kho (Thường cuối năm)
- **Cycle Count:** Kiểm từng khu vực theo lịch luân phiên (Không dừng kho)

**Quy trình:**
1. Tạo Phiên Kiểm Kê (Count Session) cho Zone cần kiểm
2. Hệ thống in/hiện Count Sheet (SKU, Bin Location, Số lượng hệ thống đang ghi)
3. Thủ kho đếm thực tế và nhập vào ERP mobile (Không thấy số hệ thống để tránh bias)
4. Hệ thống tính Variance = Thực Tế - Hệ Thống
5. Variance được Quản lý Kho review → Approve → Điều chỉnh tồn kho + Finance entry

---

## 7. Dashboard Kho (Warehouse Dashboard)

Giao diện tổng quan cho Quản lý Kho:
- **Tổng tồn kho:** Số chai / Số thùng / Giá trị VND (từ Landed Cost)
- **Heatmap vị trí:** Màu sắc thể hiện ô kệ đang trống / đang có hàng / quá tải
- **Slow-moving Alert:** SKU không xuất trong > 180 ngày
- **Sắp về (In-transit):** Từ AGN module — Container nào sắp về, số lượng dự kiến
- **Quarantine List:** Hàng đang chờ xử lý

---

## 8. Database Design

```
Warehouse → Zone → Rack → Bin (Location)
StockLot { lot_no, sku, shipment_id, qty, unit_cost, received_date, location_id, status }
StockMove { lot_id, from_location, to_location, qty, move_type, reference_id, created_at }
GoodsReceipt { gr_no, po_id, warehouse_id, status, confirmed_by, confirmed_at }
GoodsReceiptLine { gr_id, sku, lot_id, qty_expected, qty_received, variance }
DeliveryOrder { do_no, so_id, warehouse_id, status }
DeliveryOrderLine { do_id, sku, lot_id, location_id, qty_picked, qty_shipped }
PickList { do_id, assigned_to, status }
PickListLine { pick_id, sku, lot_id, bin_location, qty }
StockCountSession { zone_id, type, status, started_at, completed_at }
StockCountLine { session_id, sku, loc_id, qty_system, qty_actual, variance }
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

## 10. Implementation Status (Trạng Thái Triển Khai)

> Cập nhật 07/03/2026 — **Hoàn thiện 100%**

### ✅ Đã triển khai

| Tính năng | File code | Ghi chú |
|---|---|---|
| Warehouse CRUD | `warehouse/actions.ts` | Tạo, xem warehouses + locations |
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
| **GR Variance Report** | `getGRVarianceReport` | ✨ **MỚI** — PO ordered vs GR received per-product |
| WMS Full Stats | `getWMSFullStats` | 9 KPIs: qty, value, SKUs, quarantine, low-stock alerts |

### Chi tiết GR Variance Report

```
getGRVarianceReport(filters?: { warehouseId?, dateFrom?, dateTo? })
→ Per GR: grNo, poNo, supplier, lines[]
→ Per line: product, qtyOrdered, qtyReceived, variance, variancePct
→ Status: OK | SHORT | SURPLUS
→ hasIssues flag cho quick filter
```

*Last updated: 2026-03-07 | Wine ERP v5.0*
