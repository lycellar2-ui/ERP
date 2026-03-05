# 🚀 Wine ERP — Kế Hoạch Tối Ưu Dữ Liệu Lớn & Query Performance

**Ngày tạo:** 06/03/2026  
**Trạng thái:** 📋 Archived — Triển khai khi dữ liệu tăng  
**Tác giả:** AI Assistant  

> [!NOTE]
> Plan này được tạo khi hệ thống còn ít data. Khi dữ liệu bắt đầu nhiều (>5,000 records/bảng chính),
> hãy triển khai theo thứ tự ưu tiên Phase 1 → 7.

---

## 📊 Đánh Giá Hiện Trạng (06/03/2026)

| Thông số | Giá trị hiện tại | Vấn đề | Mục tiêu |
|----------|------------------|--------|----------|
| Database | Supabase PostgreSQL (Singapore) | Latency ~63ms/query | Giữ nguyên + cache |
| ORM | Prisma + PrismaPg adapter | OK | Giữ nguyên |
| Số bảng | ~55 bảng | - | - |
| Database Index | **6 indexes** trên 55 bảng | ❌ Full table scan | 100+ indexes |
| Pagination | **Không có** ở hầu hết modules | ❌ Load ALL records | 100% có pagination |
| Cache | In-memory Map, 30s TTL | ⚠️ Không limit size | LRU + smart TTL |
| Pool size | max 3 connections | ⚠️ Quá nhỏ | 5-10 connections |
| Query pattern | Dùng `include` (load mọi thứ) | ⚠️ Over-fetching | `select` chỉ field cần |

---

## 🏗️ Kiến Trúc Mục Tiêu

```
┌──────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                   │
│  - Virtual scroll cho danh sách > 100 items           │
│  - Debounced search (300ms)                           │
│  - Optimistic UI updates                              │
└────────────────────────┬─────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────┐
│                 NEXT.JS SERVER                        │
│  ┌────────────────────────────────────────────┐      │
│  │  LAYER 1: Server-Side Cache (LRU)          │      │
│  │  - Max 500 entries, LRU eviction            │      │
│  │  - TTL: 15s (lists), 5min (stats/KPIs)     │      │
│  │  - Smart invalidation by module prefix      │      │
│  └──────────────────┬─────────────────────────┘      │
│  ┌──────────────────▼─────────────────────────┐      │
│  │  LAYER 2: Prisma Query Layer               │      │
│  │  - Cursor-based pagination (default)        │      │
│  │  - Select only needed fields                │      │
│  │  - Batch queries with Promise.all           │      │
│  └──────────────────┬─────────────────────────┘      │
│  ┌──────────────────▼─────────────────────────┐      │
│  │  LAYER 3: Connection Pool Manager          │      │
│  │  - pg.Pool max: 5-10                        │      │
│  │  - Idle timeout: 30s                        │      │
│  │  - Statement timeout: 10s                   │      │
│  └──────────────────┬─────────────────────────┘      │
└─────────────────────┼────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────┐
│              POSTGRESQL (Supabase)                    │
│  - 100+ strategic indexes                             │
│  - Composite index cho hot queries                    │
│  - Partial index cho status filters                   │
│  - Materialized View cho Dashboard KPIs               │
└──────────────────────────────────────────────────────┘
```

---

## 📅 Lịch Trình Ưu Tiên

| Phase | Nội dung | Effort | Impact | Khi nào triển khai |
|-------|----------|--------|--------|-------------------|
| **1. Database Indexes** ⭐ | Thêm ~110 indexes | 1-2 giờ | 🔴 10-100x faster | **Ngay khi có >1K records** |
| **2. Pagination** ⭐ | Pagination utility + áp dụng | 3-4 giờ | 🔴 Ngăn OOM crash | **Ngay khi có >1K records** |
| **3. Cache LRU** | Nâng cấp cache.ts | 1 giờ | 🟡 Trung bình | Khi response time >500ms |
| **4. Query Optimization** | `select` thay `include` | 2-3 giờ | 🟡 Trung bình | Khi response time >500ms |
| **5. Pool Tuning** | Tăng pool 3→8 | 30 phút | 🟢 Thấp-TB | Khi concurrent users >5 |
| **6. Frontend** | Virtual scroll, debounce | 2-3 giờ | 🟡 UX | Khi list page chậm |
| **7. Materialized Views** | View cho KPI phức tạp | Tùy | 🔴 Scale lớn | Khi data >100K records |

---

## Phase 1: Database Indexes (~110 index mới)

> **Vì sao quan trọng nhất?** Prisma KHÔNG tự tạo index cho foreign keys. Mỗi query `where: { customerId }` 
> đang full table scan trên toàn bộ bảng. Thêm index = thay O(n) → O(log n).

### Cách triển khai

Thêm `@@index` vào `schema.prisma`, sau đó chạy:
```bash
npx prisma migrate dev --name add_performance_indexes
```

### Danh sách đầy đủ indexes cần thêm

#### SYS — System Admin & RBAC
```prisma
model UserRole {
  @@index([userId])
  @@index([roleId])
}

model RolePermission {
  @@index([roleId])
  @@index([permissionId])
}

model ApprovalRequest {
  @@index([docType, docId])
  @@index([requestedBy])
  @@index([status])
  @@index([status, requestedBy])
}

model ApprovalLog {
  @@index([requestId])
  @@index([approvedBy])
}
```

#### MDM — Master Data
```prisma
model Product {
  @@index([producerId])
  @@index([appellationId])
  @@index([status])
  @@index([wineType])
  @@index([country])
  @@index([status, wineType])
}

model PriceListLine {
  @@index([productId])
  @@index([priceListId])
}

model ProductMedia {
  @@index([productId])
}

model ProductAward {
  @@index([productId])
}
```

#### Customer & CRM
```prisma
model CustomerAddress {
  @@index([customerId])
}

model CustomerContact {
  @@index([customerId])
}

model CustomerTag {
  @@index([customerId])
}

model CustomerActivity {
  @@index([customerId])
  @@index([performedBy])
  @@index([customerId, occurredAt])
}

model SalesOpportunity {
  @@index([customerId])
  @@index([assignedTo])
  @@index([stage])
}

model ComplaintTicket {
  @@index([customerId])
  @@index([soId])
  @@index([status])
}
```

#### CNT — Contract
```prisma
model Contract {
  @@index([supplierId])
  @@index([customerId])
  @@index([status])
  @@index([endDate])
}

model ContractAmendment {
  @@index([contractId])
}

model ContractDocument {
  @@index([contractId])
}
```

#### PRC — Procurement & Import
```prisma
model PurchaseOrder {
  @@index([supplierId])
  @@index([contractId])
  @@index([status])
  @@index([createdBy])
  @@index([createdAt])
}

model PurchaseOrderLine {
  @@index([poId])
  @@index([productId])
}

model Shipment {
  @@index([poId])
  @@index([status])
  @@index([eta])
}

model LandedCostAllocation {
  @@index([campaignId])
  @@index([productId])
}
```

#### AGN — Agency Portal
```prisma
model AgencySubmission {
  @@index([shipmentId])
  @@index([partnerId])
  @@index([status])
}

model AgencyDocument {
  @@index([submissionId])
}
```

#### WMS — Warehouse
```prisma
model Location {
  @@index([warehouseId])
  @@index([type])
}

# StockLot đã có @@index([productId, status]) ✅

model GoodsReceipt {
  @@index([poId])
  @@index([shipmentId])
  @@index([warehouseId])
  @@index([status])
}

model GoodsReceiptLine {
  @@index([grId])
  @@index([productId])
  @@index([lotId])
}

model DeliveryOrder {
  @@index([soId])
  @@index([warehouseId])
  @@index([status])
}

model DeliveryOrderLine {
  @@index([doId])
  @@index([productId])
  @@index([lotId])
  @@index([locationId])
}
```

#### SLS — Sales & Allocation
```prisma
model SalesOrder {
  @@index([customerId])
  @@index([salesRepId])
  @@index([contractId])
  @@index([status])
  @@index([createdAt])
  @@index([status, createdAt])
}

model SalesOrderLine {
  @@index([soId])
  @@index([productId])
}

model SalesQuotation {
  @@index([customerId])
  @@index([salesRepId])
  @@index([status])
}

model SalesQuotationLine {
  @@index([quotationId])
  @@index([productId])
}

model AllocationQuota {
  @@index([campaignId])
}

model AllocationLog {
  @@index([quotaId])
  @@index([soLineId])
}
```

#### TRS — Transportation
```prisma
model DeliveryRoute {
  @@index([driverId])
  @@index([vehicleId])
  @@index([routeDate])
  @@index([status])
}

model DeliveryStop {
  @@index([routeId])
  @@index([doId])
  @@index([status])
}
```

#### FIN — Finance
```prisma
model JournalEntry {
  @@index([periodId])
  @@index([docType, docId])
  @@index([createdBy])
  @@index([postedAt])
}

model JournalLine {
  @@index([entryId])
  @@index([account])
}

model ARInvoice {
  @@index([soId])
  @@index([customerId])
  @@index([status])
  @@index([dueDate])
  @@index([status, dueDate])
}

model ARPayment {
  @@index([invoiceId])
}

model APInvoice {
  @@index([poId])
  @@index([supplierId])
  @@index([status])
  @@index([dueDate])
}

model APPayment {
  @@index([invoiceId])
}
```

#### CSG — Consignment
```prisma
model ConsignmentAgreement {
  @@index([customerId])
  @@index([status])
}

model ConsignmentStock {
  @@index([agreementId])
  @@index([productId])
}

model ConsignmentReport {
  @@index([agreementId])
}
```

#### STP — Stamp, Returns, Transfers
```prisma
model WineStampUsage {
  @@index([purchaseId])
  @@index([shipmentId])
  @@index([lotId])
}

model ReturnOrder {
  @@index([soId])
  @@index([customerId])
  @@index([status])
}

model ReturnOrderLine {
  @@index([returnOrderId])
  @@index([productId])
}

model CreditNote {
  @@index([customerId])
  @@index([status])
}

model TransferOrder {
  @@index([fromWarehouseId])
  @@index([toWarehouseId])
  @@index([status])
}

model TransferOrderLine {
  @@index([transferOrderId])
  @@index([productId])
}

model MarketPrice {
  @@index([productId])
  @@index([priceDate])
}

model StockCountLine {
  @@index([sessionId])
}
```

---

## Phase 2: Server-Side Pagination

### 2.1 Tạo Pagination Utility

File: `src/lib/pagination.ts`

```typescript
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export type PaginationParams = {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export type PaginatedResult<T> = {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export function getPaginationArgs(params: PaginationParams) {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE))
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize }
}

export function buildPaginatedResult<T>(
  data: T[], totalCount: number, page: number, pageSize: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(totalCount / pageSize)
  return {
    data,
    pagination: { page, pageSize, totalCount, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  }
}
```

### 2.2 Modules ưu tiên áp dụng trước

| Module | Bảng chính | Estimated rows (1 năm) | Priority |
|--------|-----------|------------------------|----------|
| **FIN** | JournalEntry, JournalLine | 20K-200K | 🔴 P0 |
| **SLS** | SalesOrder, SalesOrderLine | 5K-50K | 🔴 P0 |
| **WMS** | StockLot, GoodsReceiptLine | 10K-100K | 🔴 P0 |
| **RPT** | AuditLog | 50K-500K | 🔴 P0 |
| **TRS** | DeliveryStop, DeliveryRoute | 5K-30K | 🟡 P1 |
| **CRM** | CustomerActivity | 5K-50K | 🟡 P1 |
| **AI** | AiPromptRun | 1K-50K | 🟢 P2 |

### 2.3 Pattern chuyển đổi

```typescript
// ❌ TRƯỚC (load ALL)
export async function getSalesOrders() {
  return prisma.salesOrder.findMany({
    include: { customer: true, lines: true },
    orderBy: { createdAt: 'desc' },
  })
}

// ✅ SAU (paginated + selective)
export async function getSalesOrders(params: PaginationParams & { status?: string }) {
  const { skip, take, page, pageSize } = getPaginationArgs(params)
  const where = {
    ...(params.status && { status: params.status }),
    ...(params.search && {
      OR: [
        { soNo: { contains: params.search, mode: 'insensitive' } },
        { customer: { name: { contains: params.search, mode: 'insensitive' } } },
      ],
    }),
  }
  const [data, totalCount] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      select: {
        id: true, soNo: true, status: true, totalAmount: true, createdAt: true,
        customer: { select: { id: true, name: true, code: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip, take,
    }),
    prisma.salesOrder.count({ where }),
  ])
  return buildPaginatedResult(data, totalCount, page, pageSize)
}
```

---

## Phase 3: Nâng Cấp Cache → LRU

Thay thế `src/lib/cache.ts` hiện tại bằng LRU cache có giới hạn size:

```typescript
class LRUCache {
  private cache = new Map<string, { data: unknown; expiry: number }>()
  private maxSize: number

  constructor(maxSize = 500) { this.maxSize = maxSize }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiry) { this.cache.delete(key); return undefined }
    // LRU: move to end
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs: number) {
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value
      if (oldest) this.cache.delete(oldest)
    }
    this.cache.set(key, { data, expiry: Date.now() + ttlMs })
  }

  invalidate(prefix?: string) {
    if (!prefix) { this.cache.clear(); return }
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key)
    }
  }
}

// TTL Presets
export const TTL = {
  SHORT: 15_000,     // 15s — Lists thường xuyên thay đổi
  MEDIUM: 60_000,    // 1min — Stats, counts
  LONG: 300_000,     // 5min — KPIs, master data
  STATIC: 600_000,   // 10min — Regions, grape varieties
}
```

### Cache Strategy theo Module

| Module | Cache Key | TTL | Invalidation |
|--------|----------|-----|-------------|
| Master Data (Products) | `mdm:products:*` | LONG (5min) | Product CRUD |
| Sales Orders | `sales:orders:*` | SHORT (15s) | SO CRUD |
| Stock Lots | `wms:lots:*` | SHORT (15s) | GR/DO ops |
| Dashboard KPIs | `dashboard:kpi:*` | MEDIUM (1min) | Any mutation |
| Finance (P&L) | `fin:reports:*` | MEDIUM (1min) | Journal CRUD |
| Tax Rates | `tax:rates:*` | STATIC (10min) | Tax CRUD |
| Settings | `sys:users:*` | LONG (5min) | User CRUD |

---

## Phase 4: Query Optimization

### 4.1 Dùng `select` thay `include`

```typescript
// ❌ Over-fetching
const products = await prisma.product.findMany({
  include: { producer: true, awards: true, media: true, priceLines: true },
})

// ✅ Chỉ lấy fields cần cho list view
const products = await prisma.product.findMany({
  select: {
    id: true, skuCode: true, productName: true, wineType: true, status: true,
    producer: { select: { name: true } },
    _count: { select: { stockLots: true } },
  },
  take: 20,
})
```

### 4.2 Batch Dashboard Queries

```typescript
// ❌ Tuần tự
const total = await prisma.salesOrder.count()
const pending = await prisma.salesOrder.count({ where: { status: 'DRAFT' } })

// ✅ Song song
const [total, pending, revenue] = await Promise.all([
  prisma.salesOrder.count(),
  prisma.salesOrder.count({ where: { status: 'DRAFT' } }),
  prisma.salesOrder.aggregate({ _sum: { totalAmount: true } }),
])
```

### 4.3 Raw SQL cho KPI phức tạp

```typescript
// Khi aggregate phức tạp, dùng raw SQL
export async function getMonthlyPnL(year: number, month: number) {
  return prisma.$queryRaw`
    SELECT jl.account, SUM(jl.debit) as total_debit, SUM(jl.credit) as total_credit
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl."entryId"
    JOIN accounting_periods ap ON ap.id = je."periodId"
    WHERE ap.year = ${year} AND ap.month = ${month}
    GROUP BY jl.account ORDER BY jl.account
  `
}
```

---

## Phase 5: Connection Pool Tuning

```typescript
// src/lib/db.ts — Nâng cấp
const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 8,                     // Tăng từ 3 → 8
  min: 2,                     // Giữ sẵn 2 connections
  idleTimeoutMillis: 30000,   // 30s idle
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
  statement_timeout: 10000,   // 10s timeout per query
})
```

> ⚠️ **Supabase Free Tier** chỉ ~15 connections tổng. Pro tier cho phép tăng max lên 15-20.
> Nếu cần nhiều hơn, dùng Supabase PgBouncer (Transaction mode) qua port `6543`.

---

## Phase 6: Frontend Optimizations

### Virtual Scrolling
```typescript
// Dùng @tanstack/react-virtual cho tables > 100 rows
import { useVirtualizer } from '@tanstack/react-virtual'
```

### Debounced Search
```typescript
// Tránh query mỗi keystroke
const debouncedSearch = useDebouncedCallback((value: string) => {
  router.push(`?search=${value}&page=1`)
}, 300)
```

### Infinite Scroll (cho mobile/activity feeds)
```typescript
export async function getActivities(cursor?: string) {
  const items = await prisma.customerActivity.findMany({
    take: 20,
    ...(cursor && { skip: 1, cursor: { id: cursor } }),
    orderBy: { occurredAt: 'desc' },
  })
  return { items, nextCursor: items.length === 20 ? items[items.length - 1].id : null }
}
```

---

## Phase 7 (Tương lai): Nâng Cao

### Materialized Views — khi data >100K records
```sql
CREATE MATERIALIZED VIEW mv_monthly_sales AS
SELECT
  DATE_TRUNC('month', so."createdAt") as month,
  COUNT(*) as order_count,
  SUM(so."totalAmount") as revenue
FROM sales_orders so
WHERE so.status NOT IN ('CANCELLED', 'DRAFT')
GROUP BY DATE_TRUNC('month', so."createdAt");

-- Refresh hàng giờ
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_sales;
```

### Table Partitioning — khi >1M records/năm
```sql
-- Partition journal_lines theo năm
CREATE TABLE journal_lines_2026 PARTITION OF journal_lines
FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
```

### Soft Delete Cleanup
```sql
-- Xóa soft-deleted records > 90 ngày (chạy hàng tuần)
DELETE FROM products WHERE "deletedAt" IS NOT NULL AND "deletedAt" < NOW() - INTERVAL '90 days';
```

---

## ✅ Checklist Triển Khai

Khi bắt đầu thấy hệ thống chậm, follow checklist này:

- [ ] **Phase 1:** Thêm ~110 indexes → `npx prisma migrate dev --name add_performance_indexes`
- [ ] **Phase 2:** Tạo `src/lib/pagination.ts` → áp dụng cho SLS, WMS, FIN, RPT
- [ ] **Phase 3:** Nâng cấp `src/lib/cache.ts` → LRU + TTL presets
- [ ] **Phase 4:** Chuyển `include` → `select` ở tất cả list queries
- [ ] **Phase 5:** Tăng pool size 3→8, thêm statement timeout
- [ ] **Phase 6:** Thêm debounced search + pagination UI component
- [ ] **Phase 7:** Materialized views khi data >100K records

---

*Tài liệu này là roadmap dài hạn. Không cần triển khai ngay — chỉ implement khi performance trở thành vấn đề thực tế.*
