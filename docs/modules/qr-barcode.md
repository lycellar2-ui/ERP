# QRC — QR Code & Barcode Management
> Module quản lý mã vạch / QR Code cho từng chai rượu, hỗ trợ truy xuất nguồn gốc xuất xứ và in nhãn.

---

## 1. Bài Toán Nghiệp Vụ

**Thực tế:** Hàng nhập khẩu về **không có QR code sẵn**. Nhà sản xuất EU chỉ in barcode EAN-13 ở mức SKU (thương mại), không có thông tin nhập khẩu VN.

**Cần làm:**
1. Khi nhập kho → Tạo QR code riêng cho từng **Stock Lot** (hoặc từng chai nếu cần truy xuất đến đơn vị chai)
2. QR code mã hóa thông tin truy xuất đầy đủ (nguồn gốc, thuế, lot)
3. In nhãn dán lên chai/thùng tại kho
4. Khách hàng scan QR → xem trang truy xuất (web công khai)

---

## 2. Cấp Độ Quản Lý Mã

### Cấp 1: SKU Level (EAN-13 barcode gốc)
- Barcode từ nhà sản xuất → Dùng để **nhận dạng sản phẩm** khi nhập PO, WMS picking
- Lưu trong `Product.barcode_ean`

### Cấp 2: Lot Level QR (Mã lô nhập khẩu)
- 1 QR = 1 Stock Lot = 1 container/lô nhập
- Thông tin: SKU, LOT NO, Shipment, PO, Ngày nhập, Landed Cost
- Dùng cho: Kiểm kê, Truy xuất lô, Xuất kho nhanh

### Cấp 3: Bottle Level QR (Mã từng chai — Premium)
- 1 QR = 1 chai (Serial number)
- Áp dụng cho: Rượu Grand Cru, Allocation-only, Giá > X VND
- Có thể track từng chai từ kho → khách hàng
- Scan để claim Anti-counterfeit (chống hàng giả)

---

## 3. Thông Tin Chứa Trong QR

```json
{
  "lot_no": "LOT-2403-0042",
  "sku": "CHATEAU-PETRUS-2018-750",
  "product_name": "Château Pétrus 2018",
  "vintage": 2018,
  "producer": "Château Pétrus",
  "country_of_origin": "France",
  "appellation": "Pomerol, Bordeaux",
  "shipment_bl": "MAEU12X3456",
  "import_date": "2026-02-18",
  "customs_declaration_no": "HCM-NK-2402-0123",
  "qty_in_lot": 120,
  "warehouse": "Kho HCM - Quận 12",
  "importer": "Công ty TNHH Wine Import VN",
  "importer_address": "123 Đường ABC, Q.12, TP.HCM",
  "verify_url": "https://verify.wine-erp.com/lot/LOT-2403-0042"
}
```

---

## 4. Quy Trình Tạo & Dán QR

**Trigger:** Sau khi Confirm Goods Receipt (GR)

```
GR Confirmed
     ↓
Auto-generate QR codes (by Lot hoặc Bottle)
     ↓
Print Queue → Thủ kho in nhãn
     ↓
Nhân viên dán lên chai/thùng tại khu Receiving
     ↓
Scan QR để xác nhận → Gán vị trí Bin Location
```

### Giao diện Print Label
- Chọn: In theo Lot / In theo từng chai
- Chọn khổ giấy: **A4 (30 nhãn/trang)** hoặc **Label 100x70mm** (in nhiệt Zebra)
- Preview trước khi in
- Nhãn gồm: QR code + Tên sản phẩm + Vintage + Lot No + Ngày nhập + Barcode (EAN)

### Template nhãn
```
┌─────────────────────────────┐
│ [QR CODE]   Château Pétrus  │
│             Vintage: 2018   │
│  LOT: 2403-0042             │
│  ▌▌▌▌▌▌ EAN-13 ▌▌▌▌▌▌      │
│  Nhập: 18/02/2026 | KHO HCM │
└─────────────────────────────┘
```

---

## 5. Trang Truy Xuất Nguồn Gốc (Public)

URL: `verify.wine-erp.com/lot/{lot_no}` hoặc `verify.wine-erp.com/bottle/{serial}`

**Nội dung hiển thị (dành cho khách hàng scan QR):**
- Tên sản phẩm, hình ảnh, nhà sản xuất
- Vùng xuất xứ, Vintage, ABV%
- Ngày nhập khẩu, số tờ khai hải quan
- Tên nhà nhập khẩu chính thức
- Tasting notes, điểm đánh giá (Parker/Spectator)
- **Seal:** "✅ Hàng chính hãng — Nhập khẩu bởi [Công ty]"
- (Không hiển thị giá vốn, Landed Cost)

**Anti-counterfeit:** Mỗi QR chỉ được scan lần đầu. Lần sau hiện cảnh báo hoặc số lần scan.

---

## 6. Tích Hợp Với Các Module Khác

| Module | Tích hợp |
|---|---|
| **WMS** | Scan QR để confirm GR, picking, cycle count |
| **POS** | Scan QR/Barcode để add sản phẩm vào giỏ bán lẻ |
| **TRS** | Shipper scan QR tại điểm giao hàng → E-POD auto-fill |
| **SLS** | Scan đầu SO để xuất đúng lot |
| **CSG** | Scan QR tracking chai ký gửi tại HORECA |

---

## 7. Database Design

```
QrCodeBatch {
  id, lot_id, level (LOT | BOTTLE), qty_generated,
  template_id, printed_qty, created_at
}

QrBottleSerial {
  id, batch_id, serial_no (unique), qr_data_json,
  scan_count, last_scanned_at, last_scanned_ip
}

QrScanLog {
  id, serial_no, scanned_at, ip_address, user_agent,
  location_context (WAREHOUSE_IN | WAREHOUSE_OUT | DELIVERY | CONSUMER)
}
```

---

## 8. Hardware Requirements

| Thiết bị | Dùng cho |
|---|---|
| Máy in nhiệt Zebra ZD220 (hoặc tương đương) | In nhãn kho |
| Máy quét barcode USB/Bluetooth | Thủ kho — nhập kho, xuất kho, kiểm kê |
| Điện thoại camera | Nhân viên giao hàng scan tại điểm |
| Khách hàng điện thoại | Scan QR truy xuất nguồn gốc |

*Last updated: 2026-03-04 | Wine ERP v4.0*
