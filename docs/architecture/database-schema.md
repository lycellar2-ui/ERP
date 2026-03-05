# Database ERD — Wine ERP System
**Phase 3 — Architecture Design** | 2026-03-04

> ERD này thể hiện toàn bộ mô hình dữ liệu của 14 module. Được phân thành 3 phần:
> 1. Sơ đồ phụ thuộc giữa các Domain (Module Map)
> 2. ERD tổng hợp các Entity cốt lõi (Core ERD)
> 3. Schema chi tiết từng Domain

---

## 1. Sơ Đồ Phụ Thuộc Module (Module Dependency Map)

```mermaid
graph TB
    SYS["🔐 SYS\nAdmin & RBAC\nApproval Workflow"]
    MDM["📦 MDM\nMaster Data\nWine / Supplier / Customer"]
    CRM["🤝 CRM\nCustomer Relations\nActivity / Pipeline"]
    CNT["📑 CNT\nContracts"]
    TAX["📊 TAX\nTax Rates\nMarket Price"]
    PRC["🚢 PRC\nProcurement\nLanded Cost"]
    AGN["🏢 AGN\nAgency Portal\n(External)"]
    WMS["🏭 WMS\nWarehouse\nZone/Rack/Bin"]
    SLS["💼 SLS\nSales & Allocation"]
    CSG["🍽️ CSG\nConsignment\nHORECA"]
    TRS["🚚 TRS\nTransport & Delivery"]
    FIN["💰 FIN\nFinance & Accounting"]
    RPT["📈 RPT\nReporting & BI"]
    DSH["👑 DSH\nCEO Dashboard"]

    SYS -->|"Phân quyền"| MDM
    SYS -->|"Phân quyền"| CRM
    SYS -->|"Phân quyền"| PRC
    SYS -->|"Phân quyền"| WMS
    SYS -->|"Phân quyền"| SLS
    SYS -->|"Approval Flow"| PRC
    SYS -->|"Approval Flow"| SLS
    SYS -->|"Approval Flow"| FIN

    MDM -->|"Wine Catalog"| PRC
    MDM -->|"Wine Catalog"| WMS
    MDM -->|"Wine Catalog"| SLS
    MDM -->|"Customer Base"| CRM
    MDM -->|"Customer Base"| SLS
    MDM -->|"Supplier Base"| PRC
    MDM -->|"Supplier Base"| CNT

    CNT -->|"HĐ Mua Hàng"| PRC
    CNT -->|"HĐ Bán Hàng"| SLS
    CNT -->|"HĐ Ký Gửi"| CSG

    TAX -->|"Tax Rates"| PRC
    TAX -->|"Market Price"| SLS

    AGN -->|"Shipping Info, Costs"| PRC
    PRC -->|"GR from PO"| WMS
    WMS -->|"Pick/Issue Stock"| SLS
    WMS -->|"Off-site Stock"| CSG
    SLS -->|"Delivery Order"| TRS
    CSG -->|"Delivery"| TRS
    TRS -->|"E-POD / COD"| FIN
    SLS -->|"Invoice"| FIN
    PRC -->|"AP Invoice"| FIN
    WMS -->|"COGS"| FIN

    FIN -->|"Financial Data"| RPT
    SLS -->|"Sales Data"| RPT
    WMS -->|"Stock Data"| RPT
    PRC -->|"Tax Data"| RPT
    CRM -->|"Customer Data"| RPT

    RPT -->|"Aggregated KPIs"| DSH
    SYS -->|"Pending Approvals"| DSH
    WMS -->|"Inventory Value"| DSH
    SLS -->|"Revenue"| DSH
    AGN -->|"ETA In-transit"| DSH
    FIN -->|"AR/AP"| DSH
```

---

## 2. ERD Cốt Lõi (Core Entity Relationship Diagram)

> Mermaid ERD — Các Entity quan trọng nhất và mối quan hệ giữa chúng.

```mermaid
erDiagram
    %% ── SYS DOMAIN ──────────────────────────────────────────
    User {
        id          uuid PK
        email       string
        name        string
        dept_id     uuid FK
        status      enum
    }
    Department {
        id          uuid PK
        name        string
        parent_id   uuid FK
    }
    Role {
        id          uuid PK
        name        string
        dept_id     uuid FK
    }
    ApprovalRequest {
        id          uuid PK
        doc_type    enum
        doc_id      uuid
        step        int
        status      enum
        requested_by uuid FK
    }

    %% ── MDM DOMAIN ──────────────────────────────────────────
    Product {
        id              uuid PK
        sku_code        string
        product_name    string
        producer_id     uuid FK
        vintage         int
        appellation_id  uuid FK
        country         string
        abv_percent     decimal
        volume_ml       int
        packaging_type  enum
        units_per_case  int
        hs_code         string
        barcode_ean     string
        wine_type       enum
        is_allocation   boolean
        status          enum
    }
    Producer {
        id      uuid PK
        name    string
        country string
        region  string
    }
    Appellation {
        id          uuid PK
        name        string
        region      string
        country     string
    }
    ProductMedia {
        id          uuid PK
        product_id  uuid FK
        media_type  enum
        url         string
        is_primary  boolean
    }
    ProductAward {
        id          uuid PK
        product_id  uuid FK
        vintage     int
        source      string
        score       decimal
        medal       enum
    }
    PriceList {
        id              uuid PK
        name            string
        channel         enum
        effective_date  date
        expiry_date     date
    }
    PriceListLine {
        id          uuid PK
        pricelist_id uuid FK
        product_id  uuid FK
        unit_price  decimal
        currency    string
    }
    Supplier {
        id              uuid PK
        code            string
        name            string
        type            enum
        country         string
        trade_agreement string
        co_form         string
        payment_term    string
        default_currency string
        incoterms       string
        lead_time_days  int
        status          enum
    }
    Customer {
        id              uuid PK
        code            string
        name            string
        tax_id          string
        customer_type   enum
        channel         enum
        payment_term    string
        credit_limit    decimal
        sales_rep_id    uuid FK
        status          enum
    }
    CustomerAddress {
        id          uuid PK
        customer_id uuid FK
        label       string
        address     string
        is_billing  boolean
        is_default  boolean
    }

    %% ── CRM DOMAIN ──────────────────────────────────────────
    CustomerActivity {
        id          uuid PK
        customer_id uuid FK
        type        enum
        description text
        performed_by uuid FK
        occurred_at datetime
    }
    SalesOpportunity {
        id              uuid PK
        customer_id     uuid FK
        name            string
        expected_value  decimal
        stage           enum
        probability     int
        assigned_to     uuid FK
        close_date      date
    }
    ComplaintTicket {
        id          uuid PK
        customer_id uuid FK
        so_id       uuid FK
        type        enum
        severity    enum
        status      enum
        resolution  text
    }

    %% ── CNT DOMAIN ──────────────────────────────────────────
    Contract {
        id              uuid PK
        contract_no     string
        type            enum
        supplier_id     uuid FK
        customer_id     uuid FK
        value           decimal
        currency        string
        payment_term    string
        incoterms       string
        start_date      date
        end_date        date
        status          enum
    }

    %% ── TAX DOMAIN ──────────────────────────────────────────
    TaxRate {
        id                  uuid PK
        hs_code             string
        country_of_origin   string
        trade_agreement     string
        import_tax_rate     decimal
        sct_rate            decimal
        vat_rate            decimal
        effective_date      date
        expiry_date         date
        requires_co         boolean
        co_form_type        string
    }
    MarketPrice {
        id          uuid PK
        product_id  uuid FK
        price       decimal
        currency    string
        source      string
        price_date  date
        entered_by  uuid FK
    }

    %% ── PRC DOMAIN ──────────────────────────────────────────
    PurchaseOrder {
        id              uuid PK
        po_no           string
        supplier_id     uuid FK
        contract_id     uuid FK
        currency        string
        exchange_rate   decimal
        status          enum
        created_by      uuid FK
    }
    PurchaseOrderLine {
        id          uuid PK
        po_id       uuid FK
        product_id  uuid FK
        qty_ordered decimal
        unit_price  decimal
        uom         string
    }
    Shipment {
        id                  uuid PK
        bill_of_lading      string
        po_id               uuid FK
        vessel_name         string
        port_of_loading     string
        port_of_discharge   string
        eta                 datetime
        cif_amount          decimal
        currency            string
        status              enum
    }
    LandedCostCampaign {
        id              uuid PK
        shipment_id     uuid FK
        total_import_tax decimal
        total_sct       decimal
        total_vat       decimal
        total_other_cost decimal
        status          enum
    }
    LandedCostAllocation {
        id              uuid PK
        campaign_id     uuid FK
        product_id      uuid FK
        qty             decimal
        unit_landed_cost decimal
    }

    %% ── WMS DOMAIN ──────────────────────────────────────────
    Warehouse {
        id      uuid PK
        code    string
        name    string
        address string
    }
    Location {
        id              uuid PK
        warehouse_id    uuid FK
        zone            string
        rack            string
        bin             string
        location_code   string
        type            enum
        capacity_cases  int
    }
    StockLot {
        id              uuid PK
        lot_no          string
        product_id      uuid FK
        shipment_id     uuid FK
        location_id     uuid FK
        qty_received    decimal
        qty_available   decimal
        unit_landed_cost decimal
        received_date   date
        status          enum
    }
    GoodsReceipt {
        id          uuid PK
        gr_no       string
        po_id       uuid FK
        warehouse_id uuid FK
        status      enum
        confirmed_by uuid FK
        confirmed_at datetime
    }
    GoodsReceiptLine {
        id              uuid PK
        gr_id           uuid FK
        product_id      uuid FK
        lot_id          uuid FK
        qty_expected    decimal
        qty_received    decimal
        variance        decimal
    }
    DeliveryOrder {
        id          uuid PK
        do_no       string
        so_id       uuid FK
        warehouse_id uuid FK
        status      enum
    }
    DeliveryOrderLine {
        id          uuid PK
        do_id       uuid FK
        product_id  uuid FK
        lot_id      uuid FK
        location_id uuid FK
        qty_picked  decimal
        qty_shipped decimal
    }

    %% ── SLS DOMAIN ──────────────────────────────────────────
    SalesOrder {
        id                  uuid PK
        so_no               string
        customer_id         uuid FK
        contract_id         uuid FK
        sales_rep_id        uuid FK
        channel             enum
        shipping_address_id uuid FK
        payment_term        string
        status              enum
        total_amount        decimal
    }
    SalesOrderLine {
        id                      uuid PK
        so_id                   uuid FK
        product_id              uuid FK
        qty_ordered             decimal
        unit_price              decimal
        line_discount_pct       decimal
        allocation_campaign_id  uuid FK
    }
    AllocationCampaign {
        id          uuid PK
        name        string
        product_id  uuid FK
        total_qty   decimal
        unit        enum
        start_date  date
        end_date    date
        status      enum
    }
    AllocationQuota {
        id          uuid PK
        campaign_id uuid FK
        target_type enum
        target_id   uuid
        qty_allocated decimal
        qty_sold    decimal
    }

    %% ── CSG DOMAIN ──────────────────────────────────────────
    ConsignmentAgreement {
        id              uuid PK
        customer_id     uuid FK
        contract_id     uuid FK
        start_date      date
        end_date        date
        report_frequency enum
        status          enum
    }
    ConsignmentStock {
        id              uuid PK
        agreement_id    uuid FK
        product_id      uuid FK
        qty_consigned   decimal
        qty_sold        decimal
        qty_remaining   decimal
    }

    %% ── TRS DOMAIN ──────────────────────────────────────────
    DeliveryRoute {
        id          uuid PK
        route_date  date
        driver_id   uuid FK
        vehicle_id  uuid FK
        status      enum
    }
    DeliveryStop {
        id              uuid PK
        route_id        uuid FK
        do_id           uuid FK
        sequence        int
        address         string
        status          enum
        pod_signed_at   datetime
        cod_amount      decimal
        cod_status      enum
    }
    ProofOfDelivery {
        id              uuid PK
        stop_id         uuid FK
        signature_url   string
        photo_url       string
        confirmed_by    string
        confirmed_at    datetime
    }

    %% ── FIN DOMAIN ──────────────────────────────────────────
    ARInvoice {
        id          uuid PK
        invoice_no  string
        so_id       uuid FK
        customer_id uuid FK
        amount      decimal
        vat_amount  decimal
        due_date    date
        status      enum
    }
    ARPayment {
        id          uuid PK
        invoice_id  uuid FK
        amount      decimal
        paid_at     datetime
        method      enum
    }
    APInvoice {
        id          uuid PK
        invoice_no  string
        po_id       uuid FK
        supplier_id uuid FK
        amount      decimal
        currency    string
        due_date    date
        status      enum
    }
    JournalEntry {
        id          uuid PK
        entry_no    string
        doc_type    enum
        doc_id      uuid
        period_id   uuid FK
        posted_at   datetime
        created_by  uuid FK
    }
    JournalLine {
        id          uuid PK
        entry_id    uuid FK
        account     string
        debit       decimal
        credit      decimal
        description string
    }
    AccountingPeriod {
        id          uuid PK
        year        int
        month       int
        is_closed   boolean
        closed_by   uuid FK
        closed_at   datetime
    }
    WineStampPurchase {
        id          uuid PK
        purchaseDate date
        stampType   enum
        symbol      string
        serialStart string
        serialEnd   string
        totalQty    int
        usedQty     int
        status      enum
    }
    WineStampUsage {
        id          uuid PK
        purchaseId  uuid FK
        shipmentId  uuid FK
        lotId       uuid FK
        qtyUsed     int
        qtyDamaged  int
        usedAt      datetime
        reportedBy  uuid FK
    }

    %% ── RELATIONSHIPS ────────────────────────────────────────

    %% MDM
    Product }o--|| Producer : "sản xuất bởi"
    Product }o--o| Appellation : "có nhãn"
    Product ||--o{ ProductMedia : "có ảnh"
    Product ||--o{ ProductAward : "có giải"
    PriceList ||--o{ PriceListLine : "bao gồm"
    PriceListLine }o--|| Product : "định giá"
    Customer ||--o{ CustomerAddress : "có địa chỉ"
    Customer }o--|| User : "phụ trách bởi"

    %% CRM
    Customer ||--o{ CustomerActivity : "có hoạt động"
    Customer ||--o{ SalesOpportunity : "có cơ hội"
    Customer ||--o{ ComplaintTicket : "có khiếu nại"
    CustomerActivity }o--|| User : "thực hiện bởi"

    %% CNT
    Contract }o--o| Supplier : "với NCC"
    Contract }o--o| Customer : "với KH"

    %% TAX
    MarketPrice }o--|| Product : "giá của"

    %% PRC
    PurchaseOrder }o--|| Supplier : "đặt hàng NCC"
    PurchaseOrder }o--o| Contract : "dưới HĐ"
    PurchaseOrder ||--o{ PurchaseOrderLine : "bao gồm"
    PurchaseOrderLine }o--|| Product : "mặt hàng"
    Shipment }o--|| PurchaseOrder : "giao từ PO"
    LandedCostCampaign ||--|| Shipment : "tính cost cho"
    LandedCostCampaign ||--o{ LandedCostAllocation : "phân bổ xuống"
    LandedCostAllocation }o--|| Product : "per mặt hàng"

    %% WMS
    Warehouse ||--o{ Location : "có vị trí"
    StockLot }o--|| Product : "loại sản phẩm"
    StockLot }o--o| Shipment : "từ lô hàng"
    StockLot }o--|| Location : "tại vị trí"
    GoodsReceipt }o--|| PurchaseOrder : "nhập từ PO"
    GoodsReceipt }o--|| Warehouse : "nhập vào kho"
    GoodsReceipt ||--o{ GoodsReceiptLine : "gồm các dòng"
    GoodsReceiptLine }o--|| Product : "sản phẩm"
    GoodsReceiptLine }o--o| StockLot : "tạo lô"
    DeliveryOrder }o--|| SalesOrder : "xuất theo SO"
    DeliveryOrder }o--|| Warehouse : "từ kho"
    DeliveryOrder ||--o{ DeliveryOrderLine : "gồm các dòng"
    DeliveryOrderLine }o--|| Product : "sản phẩm"
    DeliveryOrderLine }o--|| StockLot : "lấy từ lô"
    DeliveryOrderLine }o--|| Location : "tại ô kệ"

    %% SLS
    SalesOrder }o--|| Customer : "của KH"
    SalesOrder }o--o| Contract : "dưới HĐ"
    SalesOrder }o--|| User : "do Sales Rep"
    SalesOrder ||--o{ SalesOrderLine : "bao gồm"
    SalesOrderLine }o--|| Product : "mặt hàng"
    SalesOrderLine }o--o| AllocationCampaign : "thuộc Allocation"
    AllocationCampaign }o--|| Product : "cho SKU"
    AllocationCampaign ||--o{ AllocationQuota : "phân bổ"
    ComplaintTicket }o--o| SalesOrder : "từ đơn bán"

    %% CSG
    ConsignmentAgreement }o--|| Customer : "với KH HORECA"
    ConsignmentAgreement }o--o| Contract : "theo HĐ"
    ConsignmentAgreement ||--o{ ConsignmentStock : "tồn ký gửi"
    ConsignmentStock }o--|| Product : "mặt hàng"

    %% TRS
    DeliveryRoute ||--o{ DeliveryStop : "gồm các điểm"
    DeliveryStop }o--|| DeliveryOrder : "giao cho DO"
    DeliveryStop ||--o| ProofOfDelivery : "có E-POD"

    %% FIN
    ARInvoice }o--|| SalesOrder : "từ đơn bán"
    ARInvoice }o--|| Customer : "của KH"
    ARInvoice ||--o{ ARPayment : "có thanh toán"
    APInvoice }o--|| PurchaseOrder : "từ đơn mua"
    APInvoice }o--|| Supplier : "của NCC"
    JournalEntry ||--o{ JournalLine : "bao gồm bút toán"
    JournalEntry }o--|| AccountingPeriod : "thuộc kỳ KT"
    WineStampPurchase ||--o{ WineStampUsage : "có lịch sử sử dụng"
    WineStampUsage }o--o| Shipment : "dán cho lô hàng"
    WineStampUsage }o--o| StockLot : "dán cho lô tồn kho"

    %% SYS
    ApprovalRequest }o--|| User : "yêu cầu bởi"
    User }o--|| Department : "thuộc phòng ban"
```

---

## 3. Database Domain Schemas (Prisma-style — Per Module)

> Chi tiết đầy đủ các trường của từng bảng. Đây là input để Developer viết `schema.prisma`.

Xem chi tiết tại: [`database-domain-schemas.md`](./database-domain-schemas.md)

---

## 4. Ghi Chú Thiết Kế Quan Trọng

### A. Quy Tắc Đặt Tên
- **PK:** Mọi bảng dùng `id uuid DEFAULT gen_random_uuid()`
- **FK:** Tên trường `{table_name}_id` (ví dụ: `customer_id`, `product_id`)
- **Timestamp:** Mọi bảng có `created_at`, `updated_at` (auto-managed by Prisma)
- **Soft Delete:** Các entity quan trọng (Product, Customer, Supplier) dùng `deleted_at` nullable thay vì xóa thật

### B. Multi-tenancy (Tương Lai)
- Cột `company_id` sẽ được thêm vào tất cả bảng khi cần mở rộng Multi-tenant (Chạy ERP cho nhiều công ty trên cùng 1 hệ thống)

### C. Enum Values Quan Trọng

| Enum | Values |
|---|---|
| `user.status` | ACTIVE, INACTIVE, SUSPENDED |
| `product.status` | ACTIVE, DISCONTINUED, ALLOCATION_ONLY |
| `product.wine_type` | RED, WHITE, ROSE, SPARKLING, FORTIFIED, DESSERT |
| `product.packaging_type` | OWC, CARTON |
| `supplier.type` | WINERY, NEGOCIANT, DISTRIBUTOR, LOGISTICS, FORWARDER, CUSTOMS_BROKER |
| `customer.customer_type` | HORECA, WHOLESALE_DISTRIBUTOR, VIP_RETAIL, INDIVIDUAL |
| `po.status` | DRAFT, PENDING_APPROVAL, APPROVED, IN_TRANSIT, PARTIALLY_RECEIVED, RECEIVED, CANCELLED |
| `so.status` | DRAFT, PENDING_APPROVAL, CONFIRMED, PARTIALLY_DELIVERED, DELIVERED, INVOICED, PAID, CANCELLED |
| `stocklot.status` | AVAILABLE, RESERVED, QUARANTINE, CONSUMED |
| `contract.type` | PURCHASE, SALES, CONSIGNMENT, LOGISTICS, WAREHOUSE_RENTAL |
| `location.type` | STORAGE, RECEIVING, SHIPPING, QUARANTINE, VIRTUAL |
| `mediatype` | PRODUCT_MAIN, LABEL_FRONT, LABEL_BACK, LIFESTYLE, GROUP, OWC_CASE, AWARD, WINERY |
| `doc_type (approval)` | PURCHASE_ORDER, SALES_ORDER, WRITE_OFF, DISCOUNT_OVERRIDE, TAX_DECLARATION |
| `journal_entry doc_type` | GOODS_RECEIPT, GOODS_ISSUE, SALES_INVOICE, PURCHASE_INVOICE, PAYMENT_IN, PAYMENT_OUT, ADJUSTMENT |

### D. Indexes Quan Trọng
```sql
-- Tìm tồn kho theo SKU nhanh
CREATE INDEX idx_stocklot_product ON stock_lot(product_id, status);

-- Tra cứu thuế
CREATE INDEX idx_taxrate_lookup ON tax_rate(hs_code, country_of_origin, effective_date);

-- Tìm kiếm SO theo KH
CREATE INDEX idx_so_customer ON sales_order(customer_id, status, created_at DESC);

-- Tổng hợp doanh thu theo tháng
CREATE INDEX idx_arinvoice_period ON ar_invoice(customer_id, status, created_at);

-- Allocation check
CREATE INDEX idx_quota_campaign ON allocation_quota(campaign_id, target_type, target_id);
```
