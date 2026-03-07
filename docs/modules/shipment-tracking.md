# Shipment Tracking — Quản Lý Lô Hàng (SHP)

> Phân hệ theo dõi toàn bộ vòng đời lô hàng nhập khẩu từ khi booking tàu → thông quan → nhập kho. Tích hợp chặt với Procurement (PRC), Tax & Landed Cost, Agency Portal (AGN), và WMS.

---

## 1. Tổng Quan Nghiệp Vụ

### Workflow EXW (Ex Works) — Luồng chính

```
PO Confirmed → Booking tàu → Mua bảo hiểm → Nhận chứng từ gốc
    → Xếp hàng lên container → Tàu rời cảng → Tàu cập cảng VN
    → Khai HQ → Giám định chất lượng → Thông quan → Dán tem rượu → Nhập kho
```

Với EXW, **người mua chịu toàn bộ chi phí và rủi ro** từ kho của NCC. Do đó, lô hàng cần track:
- Tất cả chi phí phát sinh (15+ loại)
- Milestones tùy chỉnh theo Incoterms
- Hải quan VN chi tiết
- Bảo hiểm hàng hóa

### Hỗ trợ 3 Incoterms chính

| Incoterms | Milestones | Đặc trưng |
|-----------|-----------|-----------|
| **EXW** | 13 bước | Buyer lo toàn bộ: xe lấy hàng, booking, bảo hiểm, freight |
| **FOB** | 12 bước | Buyer nhận rủi ro khi hàng lên tàu, NCC lo nội địa xuất |
| **CIF** | 9 bước | NCC lo vận chuyển + bảo hiểm, Buyer chỉ lo từ cảng VN |

---

## 2. Tính Năng Đã Triển Khai

### 2.1 Trang Quản Lý Lô Hàng (`/dashboard/shipments`)

**Dashboard thống kê:**
- 7 stat cards: Tổng Lô, Đã Book, Trên Tàu, Cập Cảng, Hải Quan, Thông Quan, Nhập Kho
- Bộ lọc theo trạng thái (13 status) + tìm kiếm (B/L, tàu, NCC)
- Danh sách với progress bar milestone

**Trạng thái Shipment:**
```
DRAFT → BOOKED → DOCS_READY → LOADED → ON_VESSEL → ARRIVED_PORT
    → CUSTOMS_FILING → CUSTOMS_INSPECTING → CUSTOMS_CLEARED
    → STAMPING → DELIVERED_TO_WAREHOUSE → COMPLETED | CANCELLED
```

### 2.2 Tạo Lô Hàng — Create Shipment Drawer

| Field | Mô tả | Required |
|-------|-------|----------|
| Purchase Order | Chọn PO đã duyệt (APPROVED) | ✅ |
| Bill of Lading | Số vận đơn đường biển | ✅ |
| Incoterms | EXW / FOB / CIF | ✅ |
| Vessel Name | Tên tàu (VD: MSC ROMA) | |
| Voyage No | Số chuyến (VD: VA523W) | |
| Container No | Số container | |
| Container Type | 20FT / 40FT / 40HC / Reefer / LCL | |
| Port of Loading | Cảng xuất (LOCODE) | |
| Port of Discharge | Cảng đến — mặc định VNSGN | |
| ETD / ETA | Ngày khởi hành / dự kiến đến | |
| CIF Amount + Currency | Giá trị CIF (USD/EUR/GBP) | ✅ |
| Forwarder | Chọn từ danh sách ExternalPartner | |
| Customs Broker | Chọn từ danh sách ExternalPartner | |

> **Auto-milestone:** Khi tạo shipment, hệ thống tự tạo milestones theo Incoterms (EXW: 13, FOB: 12, CIF: 9).

### 2.3 Shipment Detail Drawer (4 Tabs)

#### Tab 1: Tổng Quan (Overview)
- Info cards: Tàu, Container, Incoterms
- Port info: Cảng xuất → Cảng đến, ETD/ETA
- CIF value + progress bar
- **Milestone Timeline**: Visual checklist với click-to-complete/uncomplete
- Thêm milestone tùy chỉnh (Custom Milestone)

#### Tab 2: Chi Phí (Costs)
- Danh sách chi phí dynamic, thêm/xoá
- **15 loại cost categories:**

| Category | Tiếng Việt |
|----------|-----------|
| FREIGHT | Cước vận chuyển |
| INSURANCE | Bảo hiểm hàng hóa |
| THC_ORIGIN | THC cảng xuất |
| THC_DEST | THC cảng đến |
| TRUCKING_ORIGIN | Trucking nội địa (xuất) |
| TRUCKING_DEST | Trucking nội địa (VN) |
| CUSTOMS_FEE | Phí dịch vụ HQ |
| INSPECTION | Phí giám định |
| FUMIGATION | Phí xông trùng |
| DETENTION | Phí lưu container |
| DEMURRAGE | Phí lưu tàu |
| STAMP | Phí tem rượu |
| DOCUMENTATION | Phí chứng từ |
| BANK_CHARGE | Phí ngân hàng (LC/TT) |
| OTHER | Chi phí khác |

- Hỗ trợ đa tiền tệ (VND/USD/EUR) + tỷ giá
- Tính tổng VND tự động
- Thông tin Thanh toán (Paid To, Invoice No)

#### Tab 3: Hải Quan (Customs)
- **Tờ khai HQ VN** đầy đủ:
  - Số tờ khai, loại hình (C31/A11/A12/E31)
  - Chi cục HQ (Cát Lái, Tân Cảng...)
  - HS Code (2204.xx)
  - C/O Form: EUR.1 (EVFTA), Form D (ATIGA), AANZ, CPTPP
  - Số C/O
- **Thuế 3 tầng:**
  - Thuế NK (% + số tiền)
  - TTĐB (% + số tiền)
  - VAT (% + số tiền)
  - Tổng thuế
- **Giám định chất lượng:**
  - Đơn vị: VNATEST, Quatest 3, Vinacontrol, SGS
  - Kết quả: Đạt / Không đạt / Đang giám định
  - Ngày giám định
- Trạng thái: Nháp → Đã đăng ký → Đang giám định → Thông quan → Giải phóng

#### Tab 4: Bảo Hiểm (Insurance)
- Số hợp đồng BH
- Công ty BH: Bảo Việt, PVI, Bảo Minh, Liberty
- Giá trị BH (thường 110% CIF)
- Phí BH
- Loại BH: All Risks, WA, FPA
- Trạng thái: Active / Hết hạn / Đã claim
- Ghi chú claim

### 2.4 Phân Tích Giá Vốn (Landed Cost Breakdown)

Modal hiển thị phân tích chi tiết:

```
┌─────────────────────────────────────────────┐
│ ① Giá trị CIF (VND)                        │
│ ② Tổng Chi Phí (15 categories)             │
│ ③ Thuế (NK + TTĐB + VAT)                   │
│ ④ TỔNG GIÁ VỐN = ① + ② + ③               │
│                                              │
│ Phân bổ per SKU:                             │
│ ┌────────┬───────┬──────────┬───────────┐    │
│ │ SKU    │ SL    │ CIF/chai │ Landed/chai│   │
│ │ WN-001 │ 1200  │ 52,000   │ 125,000   │   │
│ └────────┴───────┴──────────┴───────────┘    │
│                                              │
│ Giá vốn BQ / chai: 125,000 ₫               │
└─────────────────────────────────────────────┘
```

### 2.5 Tích Hợp với PO Detail

- Từ PO detail → Section "Lô Hàng (Shipments)" → Tải và hiển thị shipments liên kết
- Click vào shipment → Mở ShipmentDetailDrawer
- Progress bar inline cho mỗi shipment

---

## 3. Database Schema

### Models chính

```prisma
model Shipment {
  id                String        @id @default(cuid())
  poId              String
  billOfLading      String        @unique
  vesselName        String?
  voyageNo          String?
  containerNo       String?
  containerType     String?
  portOfLoading     String?
  portOfDischarge   String?       @default("VNSGN")
  etd               DateTime?
  eta               DateTime?
  ata               DateTime?     // Actual Time of Arrival
  cifAmount         Decimal       @default(0)
  cifCurrency       String        @default("USD")
  freightAmount     Decimal?
  insuranceAmount   Decimal?
  incoterms         String?       @default("EXW")
  forwarderId       String?
  customsBrokerId   String?
  status            ShipmentStatus @default(BOOKED)
  // Relations
  po                PurchaseOrder @relation(fields: [poId])
  costItems         ShipmentCostItem[]
  milestones        ShipmentMilestone[]
  customsDecl       CustomsDeclaration?
  insurancePolicy   InsurancePolicy?
}

model ShipmentCostItem {
  id           String   @id @default(cuid())
  shipmentId   String
  category     String   // FREIGHT, INSURANCE, THC_ORIGIN, etc.
  description  String
  amount       Decimal
  currency     String   @default("VND")
  exchangeRate Decimal  @default(1)
  amountVND    Decimal
  paidTo       String?
  invoiceNo    String?
  paidAt       DateTime?
}

model ShipmentMilestone {
  id          String    @id @default(cuid())
  shipmentId  String
  milestone   String    // PO_CONFIRMED, LOADED, DEPARTED, etc.
  label       String
  completedAt DateTime?
  completedBy String?
  notes       String?
  sortOrder   Int       @default(0)
}

model CustomsDeclaration {
  id               String   @id @default(cuid())
  shipmentId       String   @unique
  declarationNo    String?
  declarationType  String?  // C31, A11, A12, E31
  registeredAt     DateTime?
  clearedAt        DateTime?
  customsOffice    String?
  coFormType       String?  // EUR.1, Form D, AANZ, CPTPP
  coNumber         String?
  hsCode           String?
  importTaxRate    Decimal?
  importTaxAmount  Decimal?
  sctRate          Decimal?
  sctAmount        Decimal?
  vatRate          Decimal?
  vatAmount        Decimal?
  totalTax         Decimal?
  inspectionResult String?  // PASSED, FAILED, PENDING
  inspectionBody   String?  // VNATEST, Quatest 3, SGS
  inspectionDate   DateTime?
  status           String   @default("DRAFT")
  notes            String?
}

model InsurancePolicy {
  id           String    @id @default(cuid())
  shipmentId   String    @unique
  policyNo     String?
  insurer      String?
  insuredValue Decimal?
  premium      Decimal?
  currency     String    @default("USD")
  coverageType String?   // ALL_RISKS, WA, FPA
  startDate    DateTime?
  endDate      DateTime?
  status       String    @default("ACTIVE")
  claimAmount  Decimal?
  claimNotes   String?
}
```

### Enum ShipmentStatus

```prisma
enum ShipmentStatus {
  DRAFT
  BOOKED
  DOCS_READY
  LOADED
  ON_VESSEL
  ARRIVED_PORT
  CUSTOMS_FILING
  CUSTOMS_INSPECTING
  CUSTOMS_CLEARED
  STAMPING
  DELIVERED_TO_WAREHOUSE
  WAREHOUSED
  COMPLETED
  CANCELLED
}
```

---

## 4. Server Actions (16 functions)

| Action | Mô tả |
|--------|-------|
| `getShipments` | List với filter status/search, pagination |
| `getShipmentDetail` | 360° view: info + costs + milestones + customs + insurance |
| `createShipment` | Tạo mới + auto-generate milestones theo Incoterms |
| `updateShipment` | Cập nhật thông tin tàu, dates, status |
| `completeMilestone` | Đánh dấu milestone hoàn thành + timestamp |
| `uncompleteMilestone` | Bỏ đánh dấu milestone |
| `addCustomMilestone` | Thêm milestone tùy chỉnh |
| `addCostItem` | Thêm chi phí (đa tiền tệ, auto convert VND) |
| `deleteCostItem` | Xoá chi phí |
| `getLandedCostBreakdown` | Phân tích giá vốn: CIF + costs + tax per SKU |
| `upsertCustomsDeclaration` | Tạo/cập nhật tờ khai HQ |
| `upsertInsurancePolicy` | Tạo/cập nhật bảo hiểm |
| `getShipmentStats` | Thống kê theo trạng thái |
| `getForwardersAndBrokers` | Lấy DS forwarder/broker cho dropdown |

---

## 5. UI Routes

| Route | Component | Vai trò |
|-------|-----------|---------|
| `/dashboard/shipments` | `ShipmentsClient` | Trang chính: list + create + filter |
| `/dashboard/procurement` | `ProcurementClient` | Tích hợp: xem shipments từ PO detail |
| (Drawer) | `ShipmentDetailDrawer` | 4-tab detail: Overview/Costs/Customs/Insurance |
| (Drawer) | `CreateShipmentDrawer` | Form tạo lô hàng mới |
| (Modal) | `LandedCostModal` | Phân tích giá vốn per SKU |

---

## 6. Tích Hợp Với Các Module Khác

| Module | Quan hệ |
|--------|---------|
| **PRC** (Procurement) | Shipment được tạo từ PO đã duyệt. PO status chuyển sang `IN_TRANSIT` |
| **AGN** (Agency Portal) | Forwarder/Broker được gán cho shipment. Agency update ETA, milestones |
| **TAX** | CustomsDeclaration lưu tax breakdown đối chiếu với Tax Engine |
| **CST** (Costing) | Landed Cost Breakdown cung cấp giá vốn/chai cho Costing module |
| **WMS** | Milestone `WAREHOUSED` trigger Goods Receipt trong WMS |
| **FIN** (Finance) | Cost items → Phát sinh ghi nhận Công Nợ (AP) cho Forwarder/Broker |

---

## 7. Trạng Thái Triển Khai

| Tính năng | Status |
|-----------|--------|
| Schema (5 models + enhanced PO/Shipment) | ✅ Hoàn thành |
| Server Actions (16 functions) | ✅ Hoàn thành |
| Trang Shipments `/dashboard/shipments` | ✅ Hoàn thành |
| Create Shipment Drawer | ✅ Hoàn thành |
| Shipment Detail Drawer (4 tabs) | ✅ Hoàn thành |
| Milestone Timeline (click-to-complete) | ✅ Hoàn thành |
| Cost Items Management (15 categories) | ✅ Hoàn thành |
| Customs Declaration Form (VN) | ✅ Hoàn thành |
| Insurance Policy Management | ✅ Hoàn thành |
| Landed Cost Breakdown Modal | ✅ Hoàn thành |
| PO Detail → Shipments integration | ✅ Hoàn thành |
| Sidebar navigation | ✅ Hoàn thành |

---

*Last updated: 2026-03-08 00:45 | Module SHP — 100% hoàn thành*
