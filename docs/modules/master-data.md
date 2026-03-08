# Master Data Management — MDM (Quản Lý Dữ Liệu Nền)

Phân hệ MDM là **nền tảng dữ liệu của toàn bộ hệ thống ERP**. Không có MDM, không có module nào hoạt động được. Đây là nơi lưu trữ tất cả "dữ liệu gốc" (reference data) mà các module khác dùng chung.

**3 nhóm master data chính:**
1. 🍷 **Hàng Hóa (Wine Product Catalog)**
2. 🏭 **Nhà Cung Cấp (Supplier)**
3. 👤 **Khách Hàng (Customer)** — *Chi tiết nghiệp vụ CRM xem riêng tại `crm.md`*

---

## 1. 🍷 Danh Mục Hàng Hóa (Wine Product Catalog)

### A. Thông Tin Sản Phẩm (Product / SKU)
Mỗi sản phẩm rượu vang có các thuộc tính đặc thù ngành mà ERP thông thường không có:

| Trường | Kiểu dữ liệu | Mô tả | Bắt buộc |
|---|---|---|---|
| `sku_code` | String (unique) | Mã SKU nội bộ (tự sinh) | ✅ |
| `product_name` | String | Tên rượu (Château Margaux) | ✅ |
| `producer` | String | Nhà sản xuất / Château / Winery | ✅ |
| `vintage` | Integer | Năm thu hoạch (2018, 2019...) Null = Non-vintage | |
| `appellation` | String | Vùng trồng chứng nhận (Bordeaux AOC, Burgundy AOC) | |
| `region` | String | Vùng địa lý (Bordeaux, Bourgogne, Barossa Valley) | |
| `country_of_origin` | String | Quốc gia (France, Italy, Australia...) | ✅ |
| `grape_variety` | String[] | Giống nho (Cabernet Sauvignon, Merlot, ...) | |
| `abv_percent` | Decimal | Độ cồn % — **Quyết định thuế TTĐB 35% hay 65%** | ✅ |
| `volume_ml` | Integer | Thể tích (750ml, 1500ml, 3000ml...) | ✅ |
| `format` | Enum | Standard / Magnum / Jeroboam / Methuselah | ✅ |
| `packaging_type` | Enum | OWC (Thùng gỗ) / Carton | ✅ |
| `units_per_case` | Integer | Số chai/thùng (6 hoặc 12) | ✅ |
| `hs_code` | String | Mã hàng hóa Hải quan (2204.21.xx) | ✅ |
| `barcode_ean` | String | Mã vạch EAN-13 | |
| `storage_temp_min_c` | Decimal | Nhiệt độ bảo quản tối thiểu (°C) | |
| `storage_temp_max_c` | Decimal | Nhiệt độ bảo quản tối đa (°C) | |
| `is_allocation_eligible` | Boolean | Có áp dụng cơ chế Allocation không? (Grand Cru) | ✅ |
| `classification` | String | Phân hạng (Premier Grand Cru Classé, DOC, DOCG...) | |
| `wine_type` | Enum | Red / White / Rosé / Sparkling / Fortified / Dessert | ✅ |
| `tasting_notes` | Text | Mô tả hương vị (Marketing, hiển thị cho Sales) | |
| `status` | Enum | ACTIVE / DISCONTINUED / ALLOCATION_ONLY | ✅ |

### B. Danh Mục Phụ (Sub-catalogs) — Quản Lý Tập Trung
Các giá trị này được Admin quản lý tập trung, không hardcode:
- `Appellation` (Danh sách vùng trồng chứng nhận)
- `Producer` (Danh sách nhà sản xuất với mô tả, logo, website)
- `Grape Variety` (Danh sách giống nho)
- `Wine Region` (Danh sách vùng địa lý)

### C. Bảng Giá (Price List)
Một SKU có thể có nhiều bảng giá khác nhau:

| Bảng giá | Áp dụng cho |
|---|---|
| `COST_STANDARD` | Giá vốn chuẩn (Tính từ Landed Cost — chỉ Kế toán/CEO thấy) |
| `LIST_PRICE` | Giá niêm yết trước chiết khấu |
| `HORECA_PRICE` | Giá cho kênh Hotels, Restaurants, Catering |
| `WHOLESALE_PRICE` | Giá đại lý bán buôn |
| `VIP_RETAIL_PRICE` | Giá khách VIP bán lẻ |

Mỗi bảng giá có Ngày hiệu lực và Ngày hết hiệu lực (không xóa — lưu lịch sử giá).

### D. 🖼️ Quản Lý Hình Ảnh & Media (Wine Media Library)
Rượu vang cao cấp cần hình ảnh chuyên nghiệp cho Sales đem chào KH, cho Catalog, cho Web. Hệ thống ERP sẽ là **thư viện media trung tâm** luôn up-to-date, không cần lưu trong Google Drive phân tán.

**Loại Media Được Quản Lý:**

| Loại | Mô tả | Format |
|---|---|---|
| `PRODUCT_MAIN` | Ảnh chính sản phẩm (1 chai, nền trắng) | JPG/PNG, khuyến nghị 1200×1200px |
| `PRODUCT_LABEL_FRONT` | Ảnh nhãn mặt trước | JPG/PNG |
| `PRODUCT_LABEL_BACK` | Ảnh nhãn mặt sau (Có thông tin Việt Nam) | JPG/PNG |
| `PRODUCT_LIFESTYLE` | Ảnh phong cách sống (Rượu trên bàn tiệc...) | JPG |
| `BOTTLE_GROUP` | Ảnh nhóm nhiều chai (Dùng cho Catalog) | JPG/PNG |
| `CASE_OWC` | Ảnh thùng gỗ OWC | JPG |
| `AWARD_CERTIFICATE` | Ảnh chứng chỉ, huy chương (Parker Score, Decanter...) | JPG/PDF |
| `PRODUCER_WINERY` | Ảnh nhà sản xuất, vùng trồng nho | JPG |

**Tính Năng:**
- **Upload đa ảnh:** Một SKU có thể có tối đa 20 ảnh các loại
- **Ảnh chính (Primary):** Đánh dấu 1 ảnh là ảnh đại diện chính hiển thị trong danh sách
- **Tự động resize:** Hệ thống tạo thumbnail (200x200), medium (600x600), full-size tự động
- **CDN Delivery:** Ảnh phục vụ qua CDN để tải nhanh trên mọi thiết bị
- **Bulk Upload:** Kéo thả nhiều file cùng lúc
- **Gán nhãn (Tag):** Gắn tag để dễ tìm kiếm (`red-wine`, `grand-cru`, `bordeaux`)
- **Export cho Catalog:** Tải xuống bộ ảnh của 1 SKU / nhiều SKU dưới dạng ZIP

**Giải Thưởng & Điểm Đánh Giá (Awards & Scores):**
- Robert Parker Score, Wine Spectator Score, Decanter Medal (Gold/Silver/Bronze)
- Ghi nhận kèm Vintage áp dụng (Điểm 95pt cho Vintage 2018, không phải tất cả Vintages)
- Hiển thị Badge điểm số trên Catalog/báo giá để thuyết phục KH

**Lưu Trữ:**
- File lưu trên Cloud Storage (Cloudflare R2 / AWS S3)
- DB chỉ lưu metadata + URL (không lưu file binary trong DB)

---

## 2. 🏭 Nhà Cung Cấp (Supplier Management)

### A. Thông Tin Cơ Bản
| Trường | Mô tả |
|---|---|
| `supplier_code` | Mã NCC nội bộ |
| `supplier_name` | Tên pháp lý đầy đủ |
| `supplier_type` | WINERY / NEGOCIANT / DISTRIBUTOR / LOGISTICS / FORWARDER / CUSTOMS_BROKER |
| `country` | Quốc gia (Xác định HĐ thương mại áp dụng) |
| `tax_id` | Mã số thuế tại nước họ |
| `trade_agreement` | Hiệp định FTA áp dụng khi mua hàng (EVFTA / MFN / AANZFTA / VCFTA / VKFTA...) |
| `preferred_co_form` | Loại C/O thường dùng (EUR.1 / Form AANZ / Form VC...) |
| `payment_term` | Điều khoản thanh toán (T/T 30 days / L/C at sight...) |
| `default_currency` | Đồng tiền giao dịch (EUR / AUD / USD...) |
| `incoterms` | Điều kiện giao hàng mặc định (FOB / CIF / EXW) |
| `lead_time_days` | Thời gian giao hàng trung bình (ngày) — Dự báo kế hoạch nhập |
| `credit_limit_usd` | Hạn mức tín dụng NCC cấp cho công ty (nếu có) |
| `status` | ACTIVE / INACTIVE / BLACKLISTED |

### B. Danh Sách Sản Phẩm Của NCC
- Liên kết NCC → Danh sách SKU mà NCC đó cung ứng
- Ghi nhận Giá mua FOB theo thỏa thuận (Linked to Contract)
- Lịch sử đặt hàng (Số PO đã đặt, tổng giá trị)

### C. Đánh Giá NCC (Supplier Scorecard)
- Tỷ lệ giao đúng hạn (On-time delivery rate)
- Tỷ lệ hàng bể vỡ / chất lượng không đạt từ NCC này
- Điểm đánh giá tổng thể (Rating) → Dùng trong chiến lược đa dạng nguồn hàng

### D. Supplier 360° Detail Drawer ✅ Đã Triển Khai

Khi click vào 1 NCC, mở drawer 720px bên phải với **7 tabs** lazy-loaded:

| Tab | Nội dung | Server Action |
|---|---|---|
| **Tổng quan** | Scorecard + 4 KPI cards + Info 2 cột + Contacts + Addresses | `getSupplierDetail`, `getSupplierScorecard` |
| **Đơn Hàng** | Danh sách PO + Sản phẩm NCC + Lịch sử giá | `getSupplierPOs`, `getSupplierProducts`, `getSupplierPricingHistory` |
| **Tài Chính** | 3 AP stats + Danh sách AP Invoice | `getSupplierAPInvoices` |
| **Hợp Đồng** | Danh sách contracts với NCC | `getSupplierContracts` |
| **Lô Hàng** | Danh sách shipments: B/L, vessel, ETA, CIF | `getSupplierShipments` |
| **Giấy Tờ** | Giấy tờ pháp lý gắn NCC (scope=SUPPLIER) — từ CNT module | `getSupplierRegDocs` (reg-doc-xmodule) |
| **Ghi Chú** | CRM notes + Activity timeline | `getSupplierActivities`, `createSupplierActivity` |

> **Cross-module:** Tab "Giấy Tờ" đọc dữ liệu từ CNT module (`RegulatedDocument` where `scope=SUPPLIER`).
> NCC thiếu giấy tờ sẽ hiện cảnh báo khi tạo PO (via `checkSupplierCompliance()`).

---

## 3. 👤 Khách Hàng (Customer — Basic Profile)
*(Xem chi tiết nghiệp vụ CRM và tương tác KH tại `crm.md`)*

Đây là thông tin nền của Khách hàng trong MDM — dữ liệu kế thừa để tạo SO, tính công nợ:

| Trường | Mô tả | Trạng thái UI |
|---|---|---|
| `customer_code` | Mã KH nội bộ (unique) | ✅ Bắt buộc |
| `customer_name` | Tên pháp lý / Tên thương mại | ✅ Bắt buộc |
| `short_name` | Tên viết tắt cho reports/báo cáo | ✅ Đã triển khai |
| `customer_type` | HORECA / WHOLESALE_DISTRIBUTOR / VIP_RETAIL / INDIVIDUAL | ✅ Dropdown |
| `channel` | Kênh phân phối (HORECA / WHOLESALE / VIP_RETAIL / DIRECT_INDIVIDUAL) | ✅ Dropdown + Filter |
| `tax_id` | MST để xuất hóa đơn VAT | ✅ Tìm kiếm được |
| `payment_term` | Công nợ bao nhiêu ngày (COD / NET15 / NET30 / NET45 / NET60) | ✅ Dropdown |
| `credit_limit` | Hạn mức công nợ tối đa được phép (VND) | ✅ Sortable |
| `sales_rep_id` | Nhân viên Sales phụ trách (chọn từ danh sách Users) | ✅ Dropdown + Cột bảng |
| `status` | ACTIVE / CREDIT_HOLD / INACTIVE | ✅ Filter |

**Địa chỉ (CustomerAddress):**

| Trường | Mô tả |
|---|---|
| `label` | Nhãn địa chỉ ("Kho Hà Nội", "Nhà hàng Park Hyatt") |
| `address` | Số nhà, tên đường |
| `ward` | Phường/Xã |
| `district` | Quận/Huyện |
| `city` | Thành phố (14 thành phố: HCM, HN, ĐN, Nha Trang, Phú Quốc, Hội An, Hải Phòng, Cần Thơ, Huế, Vũng Tàu, Đà Lạt, Quy Nhơn, Phan Thiết, Sapa) |
| `is_billing` | Là địa chỉ xuất hóa đơn? |
| `is_default` | Là địa chỉ mặc định? |

**Liên hệ chính (CustomerContact):**

| Trường | Mô tả |
|---|---|
| `name` | Tên người liên hệ |
| `title` | Chức vụ (Quản lý mua hàng, Giám đốc...) |
| `phone` | Số điện thoại — tìm kiếm được |
| `email` | Email — tìm kiếm được |
| `is_primary` | Là liên hệ chính? |

**Tính năng UI đã triển khai (07/03/2026):**
- ✅ **CRUD đầy đủ**: Thêm mới + Chỉnh sửa (drawer load data by ID) + Xóa (soft-delete có kiểm tra SO active)
- ✅ **Tìm kiếm mở rộng**: Tên, mã, MST, email, SĐT, tên viết tắt
- ✅ **3 filter**: Loại KH + Trạng thái + Kênh bán hàng (dynamic từ DB)
- ✅ **Sort**: Theo Tên, Hạn Mức, Đơn Hàng (asc/desc)
- ✅ **Export CSV**: Xuất toàn bộ danh sách KH ra CSV (UTF-8 BOM)
- ✅ **Import Excel**: Upload Excel hàng loạt, validate per row
- ✅ **Gán Sales Rep**: Dropdown chọn từ danh sách Users có quyền Sales

---

## 4. Quản Lý Master Data — Admin Features

### A. Import / Export Excel ✅ Đã Triển Khai
Vì công ty đang dùng Excel: Hỗ trợ upload Excel để:
- ✅ Import danh sách sản phẩm hàng loạt (Bulk Product Import)
- ✅ Import danh sách NCC, KH ban đầu (Data Migration từ Excel sang ERP)
- ✅ Export toàn bộ Master Data ra CSV (Products + Customers)

### B. Kiểm Soát Thay Đổi (Change Log)
- Mọi thay đổi trên Master Data (Sửa giá, sửa HS Code, sửa ABV) đều bị ghi log
- Ai sửa, lúc nào, giá trị cũ là gì, giá trị mới là gì → Quan trọng vì ABV ảnh hưởng thuế
- Một số trường nhạy cảm (ABV, HS Code, Credit Limit) yêu cầu được Manager approve trước khi apply

### C. Trùng Lặp (Duplicate Detection)
- Cảnh báo nếu tạo SKU mới quá giống SKU đã có (Tên + Vintage + Producer)
- Cảnh báo nếu NCC/KH mới trùng MST với record đã có
