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
| `self_declaration_url` | String | Đường link tài liệu Tự công bố sản phẩm | |
| `tasting_note_url` | String | Đường link bản Tasting Note sản phẩm | |
| `status` | Enum | ACTIVE / DISCONTINUED / ALLOCATION_ONLY | ✅ |

### A.2 Xem Chi Tiết & Tồn Kho (Product Detail View)
- **Kích hoạt bằng Row Click**: Click trực tiếp vào dòng sản phẩm trên bảng để xem nhanh chi tiết thông tin (áp dụng cho cả máy tính và điện thoại).
- **Bảo mật giá vốn (Cost Protection)**: Hệ thống tự động ẩn toàn bộ thông tin giá vốn (`costPrice`, `unitLandedCost`) trong tầm nhìn của Sales (không trả về dữ liệu giá vốn ở server-side action).
- **Chi tiết Tồn kho vật lý**: Hiển thị danh sách các lô hàng đang tồn tại trong hệ thống kho: tên kho, mã vị trí cụ thể (Zone/Rack/Bin), số lô, trạng thái (Sẵn sàng/Đặt trước/Cách ly) và số lượng khả dụng.
- **Giá bán theo kênh**: Hiển thị Giá bán lẻ niêm yết và Giá bán buôn (Wholesale) lấy từ bảng giá margin.
- **Phân quyền chỉnh sửa**: Đối với người dùng có quyền ghi (`MDM:WRITE`), Drawer xem chi tiết sẽ hiển thị thêm nút "Chỉnh sửa" để mở form cập nhật sản phẩm.
- **Tối ưu hiệu năng danh sách**:
  - **Tối giản payload**: Câu lệnh truy vấn danh sách (`getProducts`) sử dụng `select` để loại bỏ các trường mô tả chi tiết có dung lượng lớn (grapes, aromas, certification, food pairings...). Các dữ liệu này chỉ được tải động qua `getProductViewDetails` khi mở Drawer.
  - **TanStack Caching & Persistence**: Danh mục sản phẩm được đồng bộ vào cache localStorage, giúp tải lại tức thì (0ms) sau khi mở app ngày mới.
  - **Hover Prefetching**: Khi di chuột qua liên kết "Sản Phẩm" ở sidebar, dữ liệu trang 1 tự động tải ngầm trước vào cache.

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
| `supplier_code` | Mã NCC nội bộ (VD: `SUP-LVMH` hoặc `NCC-LOG-01`) |
| `supplier_name` | Tên pháp lý đầy đủ của đối tác |
| `supplier_type` | Phân loại NCC: <br>• **Quốc tế & Nhập khẩu:** `WINERY` (Nhà làm rượu), `NEGOCIANT` (Thương mại rượu), `DISTRIBUTOR` (Phân phối), `FORWARDER` (Giao nhận quốc tế), `CUSTOMS_BROKER` (Thủ tục HQ)<br>• **Trong nước & Dịch vụ (Việt Nam):** `LOGISTICS` (Vận tải & Kho bãi), `PACKAGING` (Bao bì, in ấn, hộp quà), `POSM` (Kệ tủ, ly nếm, decor), `MARKETING_EVENT` (Sự kiện, tasting, media), `OFFICE_SERVICE` (Văn phòng, IT, thiết bị), `OTHER_SERVICE` (Dịch vụ khác) |
| `country` | Quốc gia (`VN` / `Việt Nam` đối với đối tác trong nước, hoặc mã ISO `FR`, `IT`, `CL`, `AU`, `ES`, `US`, `DE`... cho quốc tế) |
| `tax_id` | Mã số thuế (MST) doanh nghiệp |
| `trade_agreement` | Hiệp định FTA áp dụng khi mua hàng quốc tế (EVFTA, AANZFTA, CPTPP, UKVFTA...) — đối với NCC nội địa hiển thị là Nội địa |
| `preferred_co_form` | Loại C/O thường dùng (EUR.1 / Form AANZ / Form VC...) |
| `payment_term` | Điều khoản thanh toán (COD, NET15, NET30, NET45, NET60, NET90, T/T Advance, L/C...) |
| `default_currency` | Đồng tiền giao dịch mặc định (`VND`, `USD`, `EUR`, `AUD`, `NZD`, `GBP`, `SGD`...) |
| `incoterms` | Điều kiện giao hàng hoặc địa điểm nhận hàng (FOB, CIF, EXW, Giao tại kho TP.HCM...) |
| `lead_time_days` | Thời gian giao hàng trung bình (ngày) — Nhà cung cấp trong nước từ 1-7 ngày, quốc tế 30-60 ngày |
| `credit_limit_usd` | Hạn mức tín dụng NCC cấp cho công ty (nếu có) |
| `port_of_loading` | Cảng bốc hàng đi (áp dụng hàng nhập khẩu) |
| `pickup_info` | Thông tin địa chỉ kho lấy hàng / điểm nhận hàng (Pickup Address) |
| `bank_account_info` | Thông tin tài khoản ngân hàng thụ hưởng (STK, Ngân hàng, Chi nhánh, Chủ tài khoản) |
| `status` | Trạng thái: `ACTIVE` / `INACTIVE` / `BLACKLISTED` |

### B. Bộ Lọc Phân Vùng Đối Tác (Segmented Region Filter)
- **Tất cả đối tác**: Xem toàn bộ danh sách NCC.
- **🇻🇳 Trong nước (Việt Nam)**: Lọc riêng các nhà cung cấp nội địa (Logistics, Bao bì, POSM, Sự kiện, Dịch vụ văn phòng).
- **🌍 Quốc tế (Nhập khẩu)**: Lọc các hãng rượu ngoại (Winery, Négociant, Distributor, Forwarder quốc tế).
- **Tự động điền dữ liệu thông minh khi tạo mới**: Khi chọn Quốc gia là Việt Nam (`VN`), hệ thống tự động thiết lập tiền tệ mặc định là `VND`, thời gian giao hàng (Lead Time) 3-7 ngày, miễn trừ hiệp định thương mại/C-O form.

### C. Danh Sách Sản Phẩm Của NCC
- Liên kết NCC → Danh sách SKU mà NCC đó cung ứng
- Ghi nhận Giá mua FOB/giá hợp đồng theo thỏa thuận
- Lịch sử đặt hàng (Số PO đã đặt, tổng giá trị)

### D. Đánh Giá NCC (Supplier Scorecard)
- Tỷ lệ giao đúng hạn (On-time delivery rate)
- Tỷ lệ hàng bể vỡ / chất lượng không đạt từ NCC này
- Điểm đánh giá tổng thể (Rating A/B/C/D/F) → Dùng trong chiến lược quản lý chuỗi cung ứng và mua sắm

### D. Supplier 360° Detail Drawer ✅ Đã Triển Khai

Khi click vào 1 NCC, mở drawer 720px bên phải với **7 tabs** lazy-loaded:

| Tab | Nội dung | Server Action |
|---|---|---|
| **Tổng quan** | Scorecard + 4 KPI cards + Info 2 cột + Quản lý Contacts (Thêm/Xóa trực tiếp) + Quản lý Địa chỉ (Thêm/Xóa Warehouse/Pickup Point trực tiếp) | `getSupplierDetail`, `getSupplierScorecard`, `createSupplierContact`, `deleteSupplierContact`, `createSupplierAddress`, `deleteSupplierAddress` |
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
| `tax_id` | MST để xuất hóa đơn VAT | ✅ Tìm kiếm & Kế thừa từ Cty Cha |
| `vat_company_name` | Tên Công Ty / Đơn vị Xuất Hóa Đơn VAT | ✅ Tùy chọn (Tự động lấy Cty Cha nếu để trống) |
| `vat_address` | Địa Chỉ Đăng Ký Thuế xuất Hóa Đơn VAT | ✅ Tùy chọn (Tự động lấy Cty Cha nếu để trống) |
| `vat_email` | Email Nhận Hóa Đơn Điện Tử VAT | ✅ Tùy chọn (Tự động lấy Cty Cha nếu để trống) |
| `payment_term` | Công nợ bao nhiêu ngày (EOM 10 / NET15 / NET30 / NET45 / NET60) | ✅ Dropdown |
| `credit_limit` | Hạn mức công nợ tối đa được phép (VND) — Đặt ở thực thể cha COMPANY | ✅ Sortable |
| `sales_rep_id` | Nhân viên Sales phụ trách (chọn từ danh sách Users) | ✅ Dropdown + Cột bảng |
| `entityType` | Loại thực thể (`COMPANY` — Công ty mẹ chịu nợ / `RESTAURANT` — Nhà hàng con) | ✅ Badge hiển thị |
| `allowDirectSO` | Cho phép đặt SO trực tiếp cho công ty mẹ (chỉ có ý nghĩa khi `entityType === 'COMPANY'`) | ✅ Checkbox |
| `brandGroup` | Tên Brand của nhà hàng (chỉ có ý nghĩa khi `entityType === 'RESTAURANT'`) | ✅ Nhập văn bản |
| `status` | ACTIVE / PENDING_APPROVAL / REJECTED / CREDIT_HOLD / INACTIVE | ✅ Filter |

> ℹ️ **Cơ chế Kế thừa & Dùng chung Thông tin VAT / SĐT từ Công Ty Cha (Parent Hierarchy Sharing):**
> - Đối với các chi nhánh / nhà hàng con (`RESTAURANT` có `parentId`), nếu các trường thông tin xuất hóa đơn VAT (`vatCompanyName`, `taxId`, `vatAddress`, `vatEmail`) được để trống, hệ thống sẽ tự động kế thừa toàn bộ thông tin VAT từ **Công Ty Cha (`COMPANY`)**.
> - Trên giao diện quản lý khách hàng, nếu mã số thuế được kế thừa từ công ty cha, danh sách sẽ hiển thị badge màu hổ da cam dạng `0316123456 (Cha)` để dễ phân biệt.
> - **Chính sách không chặn trùng lặp nội bộ tập đoàn (BUG-117 / RULE 117):** Khi khách hàng con điền MST hoặc SĐT của công ty mẹ (hoặc dùng chung với các chi nhánh anh em cùng `parentId`), hệ thống (`checkCustomerDuplicates`, `createCustomer`, `updateCustomer`) nhận diện quan hệ gia đình và cho phép lưu hợp lệ, chỉ chặn/cảnh báo trùng khi MST hoặc SĐT bị trùng với khách hàng độc lập bên ngoài.

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
- ✅ **Quy trình Phê Duyệt Khách Hàng (Customer Approval Workflow)**:
  * **Sales tạo khách hàng**: Tự động gán trạng thái `PENDING_APPROVAL` và sinh Mã KH tạm thời dạng `TEMP-YYMMDD-XXXX`.
  * **Sales Admin duyệt**: Xem danh sách chờ duyệt, ấn định Mã KH chính thức (độc nhất, không chứa `TEMP-`) và Duyệt chuyển sang `ACTIVE` (hoặc Từ chối chuyển sang `REJECTED`).
  * **Tự động duyệt công ty mẹ**: Nếu Nhà hàng được duyệt có Công ty mẹ tự sinh đang ở dạng chờ duyệt, Công ty mẹ cũng sẽ tự động được duyệt và đổi mã tương ứng (sử dụng tiền tố đầu mã trước dấu `-`, không gắn hậu tố `-M`).
  * **Thống kê & Bộ lọc cho Sale**: Thẻ hiển thị số lượng khách hàng chờ duyệt và bị từ chối trực quan ngay trên đầu trang.
- ✅ **Tìm kiếm mở rộng**: Tên, mã, MST, email, SĐT, tên viết tắt
- ✅ **Bộ lọc đa chiều (5 filter controls)**:
  * **Phân cấp khách hàng**: Tất cả / Công ty Mẹ (`PARENT_ONLY`) / Điểm bán con (`CHILD_ONLY`) / KH độc lập (`INDEPENDENT`). Kênh HORECA được chuẩn hóa 100% thuộc mô hình Cha - Con (0 khách hàng độc lập).
  * **Lọc theo Khách hàng Cha cụ thể**: Chọn đích danh Công ty Mẹ để xem toàn bộ danh mục điểm bán/nhà hàng trực thuộc (hiển thị kèm số lượng khách hàng con `(X con)`, hỗ trợ 1-click quick-filter khi bấm vào nhãn "Thuộc KH Cha" hoặc badge "X KH con" trên từng dòng bảng máy tính hoặc thẻ mobile).
  * **Loại KH**: HORECA, Phân Phối, VIP Retail, Cá Nhân.
  * **Trạng thái**: Hoạt động, Chờ duyệt, Bị từ chối, Giữ tín dụng, Tạm dừng.
  * **Kênh bán hàng**: HORECA, Corporate, Retail (dynamic đếm số lượng từ DB, responsive font chống iOS zoom).
- ✅ **Quy Tắc Sinh Mã Khách Hàng Cha Cho Điểm Bán / Nhà Hàng (HORECA Parent Code Derivation)**:
  * Khi tạo khách hàng có `entityType === 'RESTAURANT'` mà chưa chọn khách hàng cha (`parentId` trống), hệ thống tự động trích xuất phần đầu mã trước dấu gạch ngang (Head Prefix) để làm Mã Công Ty Mẹ (`COMPANY`):
    * Ví dụ: Chi nhánh `HR10106-01` -> Công ty Mẹ tự sinh có mã `HR10106` (tên lấy theo tên VAT hoặc tên khách hàng, không thêm chữ `(Cha)` hay `-M`).
    * Nếu mã Công ty Mẹ đã tồn tại trong DB, hệ thống tự động liên kết chi nhánh mới vào công ty mẹ này.
    * Đã chuẩn hóa toàn bộ 11 khách hàng HORECA lịch sử (`HR10002-01` ... `HR10106-01` và 2 CRM Leads) vào mô hình Cha-Con.
- ✅ **Thông tin & Quản trị Khách Hàng Con (Child Customer Visibility)**:
  * Trên bảng danh sách và thẻ di động: Hiển thị trực quan badge `[Users] X KH con` (kèm trạng thái kích hoạt lọc nhanh).
  * Trong biểu mẫu Customer Drawer: Hiển thị thẻ danh sách chi tiết toàn bộ các cơ sở con trực thuộc kèm Mã, Tên, Kênh và Trạng thái hoạt động.
- ✅ **Chuẩn hóa Thuật ngữ Giao diện (Terminology Harmonization)**:
  * Phân định rõ ràng theo ngữ cảnh: Pháp nhân công nợ/hóa đơn thuế sử dụng **"Công ty Mẹ"** (`MST Mẹ`, `Công ty Mẹ (Quản lý công nợ & pháp nhân)`).
  * Quan hệ phân cấp cây điểm bán sử dụng **"Khách hàng Cha"** (`Thuộc KH Cha: [Mã]`, `Khách hàng Cha (Đơn vị quản lý)`).
- ✅ **Giao diện Điện thoại Chuyên Biệt (Mobile Card View)**: Tự động chuyển đổi dạng Thẻ thông tin khách hàng trên màn hình nhỏ (< 768px), hiển thị trực quan Mã KH, MST, Sales Rep, Hạn mức, Trạng thái và nút Sửa/Xóa chạm ngón tay tiện lợi mà không cần cuộn ngang 11 cột.
- ✅ **Phân Trang Đáp Ứng (Responsive Pagination)**: Chế độ rút gọn điều hướng "Trước / Sau" kèm chỉ số trang `Trang X / Y` trên điện thoại; chế độ đầy đủ đánh số trang trên máy tính.
- ✅ **Công Thái Học Biểu Mẫu (Customer Drawer Ergonomics)**: Lưới 1 cột trên điện thoại, 2-3 cột trên máy tính; Touch target tối thiểu 44px; bảo vệ dữ liệu chưa lưu (Dirty State Guard) khi chạm viền hoặc nút Hủy.
- ✅ **Sort**: Theo Tên, Hạn Mức, Đơn Hàng (asc/desc)
- ✅ **Export CSV**: Xuất toàn bộ danh sách KH ra CSV (UTF-8 BOM)
- ✅ **Import Excel**: Upload Excel hàng loạt, validate per row
- ✅ **Gán Sales Rep**: Dropdown chọn từ danh sách Users có quyền Sales

### E. Quy trình Phê duyệt & Vai trò RBAC Chi tiết
* **Sales Rep**: Tạo mới (mã tạm thời, trạng thái chờ duyệt). Sửa được thông tin nháp/bị từ chối của mình (khi sửa nháp bị từ chối sẽ tự động chuyển về trạng thái chờ duyệt). Chỉ xem được chỉ số thống kê & danh sách khách hàng do mình phụ trách.
* **Sales Admin / Admin / CEO / Sales Manager**: Có quyền phê duyệt hoặc từ chối duyệt, xem toàn bộ chỉ số hệ thống, ấn định mã khách hàng chính thức.

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
