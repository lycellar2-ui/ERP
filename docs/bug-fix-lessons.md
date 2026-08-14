# 🐛 Bug Fix & Lessons Learned — Wine ERP

> **Mục đích:** Ghi chép lại các bug đã gặp, nguyên nhân gốc rễ, cách fix, và bài học kinh nghiệm.
> **Quy tắc:** Mỗi khi fix bug, **BẮT BUỘC** bổ sung vào file này.

---

## Mục Lục

1. [BUG-001: Max Client Connections Reached](#bug-001-max-client-connections-reached)
2. [BUG-002: Dashboard Navigation Chậm 2-5s](#bug-002-dashboard-navigation-chậm-2-5s)
3. [BUG-003: PowerShell Encoding Phá File UTF-8](#bug-003-powershell-encoding-phá-file-utf-8)
4. [BUG-004: Build Fail — Prerender Exhausts DB Pool](#bug-004-build-fail--prerender-exhausts-db-pool)
5. [BUG-005: Build Fail — Non-Async Export in 'use server'](#bug-005-build-fail--non-async-export-in-use-server-file)
6. [BUG-006: MaxClientsInSessionMode on Vercel Runtime](#bug-006-maxclientsinsessionmode-on-vercel-runtime)
7. [BUG-007: Stat Cards Tính Sai — Chỉ Đếm Page Hiện Tại](#bug-007-stat-cards-tính-sai--chỉ-đếm-page-hiện-tại)
8. [BUG-008: Git Commit Message Dài Gây Treo Terminal](#bug-008-git-commit-message-dài-gây-treo-terminal)
9. [BUG-009: Build Fail — Many-to-Many Relation Query Sai](#bug-009-build-fail--many-to-many-relation-query-sai)
10. [BUG-010: Quotation Drawer Infinite Loading — Prisma Decimal Serialization](#bug-010-quotation-drawer-infinite-loading--prisma-decimal-serialization)
11. [BUG-011: Vercel Production Crash — Module-Level SDK Init Without API Key](#bug-011-vercel-production-crash--module-level-sdk-init-without-api-key)
12. [BUG-012: Unauthenticated Server Actions — Data Mutation Without Auth Check](#bug-012-unauthenticated-server-actions--data-mutation-without-auth-check)
13. [BUG-013: Prisma Decimal Serialization Across All Modules](#bug-013-prisma-decimal-serialization-across-all-modules)
14. [BUG-014: Finance Module — 6 lỗi Critical (Validation, Accounting, Data Sync)](#bug-014-finance-module--6-lỗi-critical-validation-accounting-integrity-data-sync)
15. [BUG-015: Toàn Hệ Thống Chậm — 11 Action Files Thiếu Cache](#bug-015-toàn-hệ-thống-chậm--11-action-files-thiếu-cache--3-pages-thiếu-loadingtsx)
16. [BUG-016: force-dynamic Trên Layout Giết Router Cache](#bug-016-force-dynamic-trên-layout-giết-router-cache)
17. [BUG-017: Floor Plan Drawing Tools Bị Chặn — pointerEvents + ESC + Pan](#bug-017-floor-plan-drawing-tools-bị-chặn--pointerevents--esc--pan)
18. [BUG-018: Sales Order Tab Loading Chậm — Multi-Waterfall Server Actions & SQL Count Joins](#bug-018-sales-order-tab-loading-chậm--multi-waterfall-server-actions--sql-count-joins)
19. [BUG-019: Trang Danh Mục Sản Phẩm Tải Chậm Trên Điện Thoại (8s) — Invalidation Cache Sai & Responsive DOM Overhead](#bug-019-trang-danh-mục-sản-phẩm-tải-chậm-trên-điện-thoại-8s--invalidation-cache-sai--responsive-dom-overhead)
20. [BUG-020: 504 MIDDLEWARE_INVOCATION_TIMEOUT Trên Điện Thoại / Khách Hàng Truy Cập Lần Đầu](#bug-020-504-middleware_invocation_timeout-trên-điện-thoại--khách-hàng-truy-cập-lần-đầu)
21. [BUG-021: 504 MIDDLEWARE_INVOCATION_TIMEOUT Khi Đã Có Cookie và DB Đang Ngủ (Cold Start) — Promise.race Timeout](#bug-021-504-middleware_invocation_timeout-khi-đã-có-cookie-và-db-đang-ngủ-cold-start--promiserace-timeout)
22. [BUG-022: Trễ tải dữ liệu khi mở Drawer Chỉnh sửa Sản phẩm](#bug-022-trễ-tải-dữ-liệu-khi-mở-drawer-chỉnh-sửa-sản-phẩm)
23. [BUG-023: Build Fail — TypeScript Type Mismatch on Nested Prisma Connect](#bug-023-build-fail--typescript-type-mismatch-on-nested-prisma-connect)
24. [BUG-033: Lỗi Trùng Mã Đơn Hàng (soNo Unique Constraint Failed) Khi Tạo Đơn Bán Hàng](#bug-033-lỗi-trùng-mã-đơn-hàng-sono-unique-constraint-failed-khi-tạo-đơn-bán-hàng)
25. [BUG-034: Lỗi Chữ Tàng Hình / Trắng Trên Nền Trắng Thẻ Xuất Kho (DO Cards)](#bug-034-lỗi-chữ-tàng-hình--trắng-trên-nền-trắng-thẻ-xuất-kho-do-cards)
26. [BUG-035: Lỗi Foreign Key Constraint (products_appellationId_fkey) Khi Tạo Mới Sản Phẩm](#bug-035-lỗi-foreign-key-constraint-products_appellationid_fkey-khi-tạo-mới-sản-phẩm)
27. [BUG-036: SWR Cache Stale Trên Tờ Trình, Cột Mã Cha Khách Hàng & Lỗi Chữ Tàng Hình Pháp Nhân](#bug-036-swr-cache-stale-trên-tờ-trình-cột-mã-cha-khách-hàng--lỗi-chữ-tàng-hình-pháp-nhân)
28. [BUG-037: Diễn Giải / Ghi Chú Đơn Hàng Bị Ẩn Trên Chi Tiết & Trang In](#bug-037-diễn-giải--ghi-chú-đơn-hàng-bị-ẩn-trên-chi-tiết--trang-in)
29. [BUG-038: Số Lượng Thẻ Trạng Thái (Tab Counts) Không Lọc Theo Bộ Lọc Ngày / Tìm Kiếm](#bug-038-số-lượng-thẻ-trạng-thái-tab-counts-không-lọc-theo-bộ-lọc-ngày--tìm-kiếm)
30. [BUG-039: Thẻ Xuất Kho DO Không Hiển Thị Tên Khách Hàng và Mã SKU / Tên Sản Phẩm](#bug-039-thẻ-xuất-kho-do-không-hiển-thị-tên-khách-hàng-và-mã-sku--tên-sản-phẩm)
31. [BUG-042: Thủ Kho Nhìn Thấy Nút Xuất Hóa Đơn & Nút Tạo Đơn Hàng](#bug-042-thủ-kho-nhìn-thấy-nút-xuất-hóa-đơn--nút-tạo-đơn-hàng-do-thiếu-kiểm-tra-rbac-trên-ui--server-action)
32. [BUG-043: Kế Toán & Trưởng Phòng Không Hiển Thị Nút Duyệt Tờ Trình Cơ Chế Giá](#bug-043-kế-toán--trưởng-phòng-không-hiển-thị-nút-duyệt-tờ-trình-cơ-chế-giá-do-hardcode-điều-kiện-isceo)
33. [BUG-044: Tài Khoản Kế Toán Không Xem Được Danh Sách Khách Hàng (Chưa có khách hàng nào)](#bug-044-tài-khoản-kế-toán-không-xem-được-danh-sách-khách-hàng-chưa-có-khách-hàng-nào-do-lỗi-alias-role-và-quyền-mdmread)
34. [BUG-045: Báo Cáo Nhập Xuất Tồn Sai Tồn Đầu Kỳ & Sai Số Liệu Luân Chuyển Khi Lọc Tất Cả Kho](#bug-045-báo-cáo-nhập-xuất-tồn-sai-tồn-đầu-kỳ--sai-số-liệu-luân-chuyển-khi-lọc-tất-cả-kho)

---

## BUG-001: Max Client Connections Reached

**Ngày:** 2026-03-05
**Severity:** 🔴 Critical — App không thể query DB

### Triệu chứng
```
prisma:error MaxClientsInSessionMode: max clients reached
Error [DriverAdapterError]: Max client connections reached
```

### Nguyên nhân gốc rễ

| Yếu tố | Chi tiết |
|---------|----------|
| **Supabase Free Tier** | Giới hạn ~15 concurrent DB connections |
| **Zombie processes** | `seed-extra.ts` chạy 2+ tiếng, giữ connections không release |
| **Nhiều processes cùng lúc** | Dev server (3 conn) + Seed script (3 conn) + Prisma CLI (2 conn) + Git hooks |
| **Double pooling** | `pg.Pool` (client-side) + PgBouncer (Supabase) = conflict |

### Cách fix

1. **Giảm pool size:** `pg.Pool({ max: 3 })` thay vì mặc định 10
2. **Thêm `allowExitOnIdle: true`** cho tất cả pool configs (db.ts + seed scripts)
3. **Chuyển sang Session Pooler** (port 5432) thay vì Transaction Pooler (port 6543) cho local dev
4. **Kill zombie processes** khi phát hiện chạy quá lâu

### Bài học

> ⚠️ **RULE 1: Không bao giờ chạy đồng thời dev server + seed script + prisma CLI.**
> Dừng dev server trước khi seed hoặc db push.

> ⚠️ **RULE 2: Kiểm tra zombie processes trước khi debug connection errors.**
> `Get-Process -Name "node" | Format-Table Id, CPU, StartTime`

> ⚠️ **RULE 3: Supabase Free Tier = max ~15 connections.**
> `pg.Pool({ max: 3 })` là an toàn. KHÔNG tăng lên 5+ khi dev local.

---

## BUG-002: Dashboard Navigation Chậm 2-5s

**Ngày:** 2026-03-05
**Severity:** 🟡 Performance — UX kém

### Triệu chứng
- Click sidebar → đứng hình 2-5 giây → page mới hiện
- Không có loading indicator
- Mỗi lần navigate đều query DB lại từ đầu

### Nguyên nhân gốc rễ

| Yếu tố | Chi tiết |
|---------|----------|
| **`force-dynamic` trên mọi page** | Buộc server render mỗi lần navigate, không cache |
| **Không có `loading.tsx`** | Không có skeleton → user thấy trang cũ đứng im |
| **Layout là Client Component** | `'use client'` trên layout → chặn streaming |
| **Không có server-side cache** | Mỗi page gọi 5-7 queries → 300-500ms mỗi lần |
| **Latency Supabase Singapore** | ~63ms/query round trip |

### Cách fix (4 tầng)

**Tầng 1 — Visual feedback (instant):**
- Thêm `NavigationProgress.tsx` — thanh progress bar
- Thêm `loading.tsx` cho 30+ sub-routes — skeleton shimmer

**Tầng 2 — Architecture (streaming):**
- Convert `layout.tsx` → Server Component
- Tách `DashboardShell.tsx` (Client Component cho sidebar state)
- Wrap children trong `<Suspense>` → page stream song song

**Tầng 3 — Client-side cache:**
- `next.config.ts`: `staleTimes: { dynamic: 30, static: 180 }`
- Trang đã xem trong 30s → hiện lại ngay từ browser cache

**Tầng 4 — Server-side cache (THỰC SỰ NHANH):**
- Tạo `src/lib/cache.ts` — in-memory Map cache với TTL
- Wrap tất cả READ functions trong `cached(key, fn, ttl)`
- Request thứ 2+ = **0ms DB** (trả từ server memory)
- Mutations gọi `revalidateCache(prefix)` để invalidate

### Cache TTL guidelines

| Loại data | TTL | Lý do |
|-----------|-----|-------|
| Dashboard stats, sales stats | 30s | Thay đổi khi có giao dịch mới |
| Financial reports (P&L, Cash, AR) | 60s | Thay đổi theo giao dịch |
| Chart data (monthly revenue) | 60s | Thay đổi chậm |
| Reference data (customers, reps) | 60-120s | Hiếm khi thay đổi |
| Heavy computation (slow stock) | 120s | Tính toán nặng, thay đổi rất chậm |

### Bài học

> ⚠️ **RULE 4: Mọi page trong `/dashboard/*` PHẢI có `loading.tsx`.**
> Nếu không có → user thấy đứng hình khi navigate.

> ⚠️ **RULE 5: Layout Server Component, interactive state → tách Client Component riêng.**
> Không đặt `'use client'` trên layout.tsx.

> ⚠️ **RULE 6: Mọi READ function nên wrap trong `cached()` từ `@/lib/cache`.**
> Pattern: `return cached('prefix:key', async () => { ... }, TTL_MS)`
> Mutations phải gọi `revalidateCache('prefix')`.

> ⚠️ **RULE 7: `staleTimes` trong next.config.ts là BẮT BUỘC.**
> Nó cache RSC payload trên browser. Không có = mỗi navigate đều server round-trip.

---

## BUG-003: PowerShell Encoding Phá File UTF-8

**Ngày:** 2026-03-05
**Severity:** 🟠 Medium — Code bị mojibake, build lỗi

### Triệu chứng
- File `.tsx` chứa tiếng Việt bị hiển thị sai: `Ä\u0090Æ¡n BÃ¡n HÃ ng` thay vì `Đơn Bán Hàng`
- Build fail do syntax error trong file bị corrupt
- `git diff` hiện binary changes

### Nguyên nhân gốc rễ

PowerShell `Set-Content` mặc định dùng **UTF-16LE** (BOM), không phải UTF-8.
Khi dùng PowerShell để sửa file code:
```powershell
# ❌ SAI — phá encoding
(Get-Content file.tsx) -replace 'old', 'new' | Set-Content file.tsx

# ✅ ĐÚNG — giữ UTF-8
$content = [System.IO.File]::ReadAllText('file.tsx')
$content = $content -replace 'old', 'new'
[System.IO.File]::WriteAllText('file.tsx', $content, [System.Text.Encoding]::UTF8)
```

### Cách fix
- Checkout file từ Git: `git checkout HEAD -- path/to/file.tsx`
- Hoặc dùng `[System.IO.File]::WriteAllText()` với `[System.Text.Encoding]::UTF8`

### Bài học

> ⚠️ **RULE 8: KHÔNG BAO GIỜ dùng `Set-Content` cho file code.**
> Luôn dùng `[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)`
> Hoặc tốt hơn: dùng tool `replace_file_content` / `multi_replace_file_content`.

> ⚠️ **RULE 9: Sau khi sửa file bằng PowerShell, check encoding:**
> `Get-Content file.tsx | Select-Object -First 3` — nếu thấy ký tự lạ → file bị corrupt.

---

## BUG-004: Build Fail — Prerender Exhausts DB Pool

**Ngày:** 2026-03-05 → **Cập nhật:** 2026-03-06
**Severity:** 🟠 Medium — Production build không thành công

### Triệu chứng
```
Error occurred prerendering page "/dashboard/allocation"
MaxClientsInSessionMode: max clients reached
Next.js build worker exited with code: 1
```

### Nguyên nhân gốc rễ

`export const revalidate = 30` khiến Next.js **prerender tất cả 30+ pages cùng lúc** khi build.
Mỗi page gọi 5-7 DB queries → 150+ concurrent queries → vượt giới hạn Session mode (port 5432).

### Cách fix (Cập nhật 06/03)

Chuyển DATABASE_URL sang **Transaction mode (port 6543 + pgBouncer)**:
```env
# ✅ ĐÚNG — pgBouncer multiplex connections
DATABASE_URL=postgresql://...@pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require

# ❌ SAI — Session mode giới hạn connections
DATABASE_URL=postgresql://...@pooler.supabase.com:5432/postgres?sslmode=require
```

Kết hợp ISR + stagger revalidation (30/45/60/90s) để không tất cả pages cùng revalidate.

### Bài học

> ⚠️ **RULE 10: Vercel PHẢI dùng Transaction Pooler (port 6543 + pgBouncer).**
> Session mode (port 5432) giới hạn ~15 connections → exhausts khi ISR prerender.
> Transaction mode multiplex được 100+ concurrent queries qua ít connections thực.

> ⚠️ **RULE 11: Luôn test `npx next build` sau khi thay đổi page config.**
> Build fail = deploy fail. Check exit code 0 trước khi push.

---

## BUG-005: Build Fail — Non-Async Export in 'use server' File

**Ngày:** 2026-03-06
**Severity:** 🟠 Medium — Vercel build fail, deploy blocked

### Triệu chứng
```
Error: Turbopack build failed with 1 errors:
./wine-erp/src/app/dashboard/actions.ts:760:17
Server Actions must be async functions.
```

### Nguyên nhân gốc rễ

File `actions.ts` có `'use server'` directive. Next.js 16 (Turbopack) yêu cầu **tất cả exported functions** trong file `'use server'` phải là `async`.

`getRealtimeChannels()` là sync function (return trực tiếp `RealtimeChannelConfig[]`, không cần await) nhưng vẫn **bắt buộc** phải khai báo `async` khi export từ server action file.

```typescript
// ❌ SAI — build fail
export function getRealtimeChannels(roles: string[]): RealtimeChannelConfig[] { ... }

// ✅ ĐÚNG
export async function getRealtimeChannels(roles: string[]): Promise<RealtimeChannelConfig[]> { ... }
```

### Cách fix

Thêm `async` keyword và đổi return type thành `Promise<RealtimeChannelConfig[]>`.

### Bài học

> ⚠️ **RULE 12: Mọi exported function trong file `'use server'` PHẢI là `async`.**
> Kể cả function không cần await — Next.js enforce rule này lúc build.
> Nếu function không cần server, tách ra file riêng không có `'use server'` directive.

---

## BUG-006: MaxClientsInSessionMode on Vercel Runtime

**Ngày:** 2026-03-06
**Severity:** 🔴 Critical — App trả 500 error khi user navigate

### Triệu chứng
```
prisma:error MaxClientsInSessionMode: max clients reached
Error [DriverAdapterError]: MaxClientsInSessionMode
page: '/dashboard/allocation'
```

### Nguyên nhân gốc rễ

| Yếu tố | Chi tiết |
|---------|----------|
| **ISR + SWR cùng lúc** | ISR revalidation + SWR background refresh tạo nhiều concurrent queries |
| **Session mode (port 5432)** | Supabase giới hạn connections per client, không multiplex |
| **30 pages cùng revalidate** | "Thundering herd" — tất cả pages hết cache cùng lúc |
| **Thiếu dedup guard** | Nhiều request cho cùng cache key → nhiều DB connections song song |

### Cách fix (4 lớp)

1. **Chuyển Transaction mode (port 6543 + pgBouncer)** — multiplex connections hiệu quả
2. **Thêm SWR dedup guard** — `pendingRefreshes` Set ngăn nhiều background refresh cùng key
3. **Stagger ISR revalidation** — core=30s, frequent=45s, normal=60s, rare=90s
4. **Cache Prisma singleton** — `globalForPrisma.prisma = prisma` cả dev + prod

### Bài học

> ⚠️ **RULE 13: SWR background refresh PHẢI có dedup guard.**
> Dùng `Set<string>` để track pending refreshes — chỉ 1 refresh per key tại mỗi thời điểm.

> ⚠️ **RULE 14: ISR revalidation intervals phải STAGGER.**
> Không set cùng 1 giá trị cho tất cả pages → thundering herd pattern.
> Group pages theo tần suất sử dụng: 30/45/60/90 giây.

---

## BUG-007: Stat Cards Tính Sai — Chỉ Đếm Page Hiện Tại

**Ngày:** 2026-03-07
**Severity:** 🟠 Medium — Dữ liệu thống kê hiển thị sai

### Triệu chứng
- Trang Sản Phẩm: "Đang kinh doanh" hiện **20** thay vì **112**, "Hết hàng" hiện **20** thay vì **103**
- Trang Khách Hàng: "Hạn mức cao" chỉ đếm 25 KH trên page, "Tổng hạn mức" chỉ cộng 25 records
- Trang NCC: "Quốc gia" chỉ đếm unique countries từ 25 NCC trên page 1

### Nguyên nhân gốc rễ

| Yếu tố | Chi tiết |
|---------|----------|
| **Client-side computation từ paginated data** | Stat cards trong `*Client.tsx` dùng `rows.filter(...)` và `rows.reduce(...)` |
| **`rows` chỉ chứa 20-25 records** | Server trả paginated data (`skip/take`), không phải toàn bộ DB |
| **Pattern lặp lại ở 3 modules** | Products, Customers, Suppliers — cùng sai |
| **Không ai nhận ra khi data ít** | Khi tổng < pageSize, stats "tình cờ" đúng → bug ẩn |

### Cách fix

**Pattern thống nhất cho cả 3 modules:**

1. **Tạo `get{Module}Stats()` server action** trong `actions.ts`:
   - `prisma.{model}.count()` cho tổng / active / conditions
   - `prisma.{model}.aggregate()` cho sum / avg
   - `prisma.{model}.groupBy()` cho phân nhóm
   - Wrap trong `cached('prefix:stats', fn, 30_000)` để tối ưu performance

2. **Update `page.tsx`** — fetch stats song song với rows:
   ```typescript
   const [{ rows, total }, stats] = await Promise.all([
       getProducts({ page: 1, pageSize: 20 }),
       getProductStats(),  // <-- aggregated from DB
   ])
   return <ProductsClient initialRows={rows} initialTotal={total} stats={stats} />
   ```

3. **Update `*Client.tsx`** — nhận `stats` prop, bỏ `rows.filter(...)`:
   ```diff
   - const activeCount = rows.filter(r => r.status === 'ACTIVE').length
   + // Use stats from server (counts ALL products, not just current page)
   ```

### Files đã sửa

| File | Thay đổi |
|------|----------|
| `products/actions.ts` | + `getProductStats()` |
| `products/page.tsx` | Fetch `getProductStats()` parallel |
| `products/ProductsClient.tsx` | Dùng `stats` prop |
| `customers/actions.ts` | + `getCustomerStats()` |
| `customers/page.tsx` | Fetch `getCustomerStats()` parallel |
| `customers/CustomersClient.tsx` | Dùng `stats` prop |
| `suppliers/actions.ts` | + `getSupplierStats()` |
| `suppliers/page.tsx` | Fetch `getSupplierStats()` parallel |
| `suppliers/SuppliersClient.tsx` | Dùng `stats` prop |

### Bài học

> ⚠️ **RULE 15: KHÔNG BAO GIỜ tính stats từ `rows` (paginated data) trên client.**
> Stats PHẢI được aggregate từ DB bằng server action (`count()`, `aggregate()`, `groupBy()`).
> Khi data < pageSize, bug sẽ ẩn → chỉ lộ khi dữ liệu tăng lên.
> **Pattern:** `page.tsx` fetch `getXxxStats()` → pass `stats` prop → client hiển thị.

> ⚠️ **RULE 16: Khi tạo module mới có stat cards, LUÔN tạo `get{Module}Stats()` từ đầu.**
> Tham khảo `getProductStats()`, `getCustomerStats()`, `getSupplierStats()` làm template.

---

## Template cho Bug mới

```markdown
## BUG-XXX: [Tiêu đề ngắn]

**Ngày:** YYYY-MM-DD
**Severity:** 🔴 Critical / 🟠 Medium / 🟡 Low

### Triệu chứng
[Mô tả lỗi user thấy]

### Nguyên nhân gốc rễ
[Phân tích WHY — không chỉ WHAT]

### Cách fix
[Các bước đã thực hiện]

### Bài học
> ⚠️ **RULE N: [Quy tắc rút ra]**
```

---

| 22 | **KHÔNG khởi tạo SDK ở module-level nếu env var có thể missing** | SDK Init |

---

## BUG-008: Git Commit Message Dài Gây Treo Terminal

**Ngày:** 2026-03-07
**Severity:** 🟡 Medium — Không ảnh hưởng logic, nhưng phí thời gian

### Triệu chứng
```
git commit -m "feat: very long message with multi-line body..." → Treo vô hạn
```

### Nguyên nhân
- Windows PowerShell xử lý chuỗi dài trong `-m` kém
- Multi-line commit message qua `-m` gây parse error trên OneDrive path spaces
- Terminal timeout khi đợi git response

### Cách fix
```bash
# ❌ SAI — message dài, multi-line
git commit -m "feat: implement file storage — ImgBB for images + Supabase Storage for documents

- Add src/lib/imgbb.ts — ImgBB upload service
- Add src/lib/supabase-storage.ts — Supabase Storage
- Add ImageUploader component
- Add DocumentUploader component"

# ✅ ĐÚNG — ngắn gọn, < 72 ký tự
git commit -m "feat: add Media Library page + Marketing sidebar"
```

### Quy tắc Git Commit
| Quy tắc | Ví dụ |
|---------|-------|
| Prefix: `feat:`, `fix:`, `docs:`, `refactor:` | `feat: add media library` |
| Max 72 ký tự | Không vượt quá |
| Không dùng body (`-m` chỉ 1 dòng) | Thêm body qua PR description |
| Ngôn ngữ: English | Nhất quán |

### Bài học
> **Git commit = tweet, không phải essay.** Chi tiết để trong PR description hoặc docs.

---

## BUG-009: Build Fail — Many-to-Many Relation Query Sai

**Ngày:** 2026-03-07
**Severity:** 🟠 Medium — Vercel build fail

### Triệu chứng
```
Type error: Object literal may only specify known properties, but 'role' does not 
exist in type 'UserWhereInput'. Did you mean to write 'roles'?
```

### Nguyên nhân gốc rễ

User model dùng **many-to-many** relationship với Role qua pivot table `UserRole`:
```prisma
model User {
  roles UserRole[]   // ← Đây là relation, KHÔNG phải field trực tiếp
}

model UserRole {
  user  User   @relation(fields: [userId], references: [id])
  role  Role   @relation(fields: [roleId], references: [id])
}

model Role {
  name String
}
```

Query sai:
```typescript
// ❌ SAI — `role` không tồn tại trên User
prisma.user.findMany({ where: { role: { in: ['ADMIN', 'SALES_REP'] } } })

// ✅ ĐÚNG — navigate qua pivot table
prisma.user.findMany({
    where: {
        roles: { some: { role: { name: { in: ['ADMIN', 'SALES_REP'] } } } }
    }
})
```

### Bài học

> ⚠️ **RULE 19: Many-to-many relation phải query qua `{ some: { pivot: { field: ... } } }`.**
> LUÔN check Prisma schema trước khi viết where clause.
> `User.roles` → `UserRole[]` → phải dùng `roles: { some: { role: { name: ... } } }`.

---

## BUG-010: Quotation Drawer Infinite Loading — Prisma Decimal Serialization

**Ngày:** 2026-03-08
**Severity:** 🔴 Critical — Drawer không load, UX bị chặn hoàn toàn

### Triệu chứng
- Click mở drawer Chi Tiết Báo Giá → loading spinner vô hạn
- Console: "Decimal objects are not supported" (dev) hoặc "QT: undefined" (prod)

### Nguyên nhân gốc rễ

| Yếu tố | Chi tiết |
|---------|----------|
| **Prisma Decimal type** | `totalAmount`, `orderDiscount`, `qtyOrdered`, `unitPrice`, `lineDiscountPct` là `Decimal` |
| **Next.js serialization** | Server Actions → Client Components chỉ chấp nhận plain objects |
| **`...raw` spread không đủ** | Prisma model instances chứa non-enumerable internal properties |
| **Thiếu try-catch** | `openDetail()` không catch → `setDetailLoading(false)` không chạy |

### Cách fix

```typescript
// ✅ ĐÚNG — JSON serialize rồi convert Decimal fields
const plain = JSON.parse(JSON.stringify(raw))
plain.totalAmount = Number(raw.totalAmount)
return { success: true, data: plain }

// ❌ SAI — Prisma instance spread vẫn chứa Decimal
return { ...raw, totalAmount: Number(raw.totalAmount) }
```

### Bài học

> ⚠️ **RULE 20: Server Actions trả Prisma data PHẢI serialize bằng `JSON.parse(JSON.stringify())`.**
> `{...raw}` không đủ — Prisma objects chứa internal metadata không serializable.

> ⚠️ **RULE 21: Server Actions nên return `{ success, data/error }` thay vì throw.**
> Vercel production redact error messages. Structured response cho phép hiển thị lỗi cụ thể.

---

## BUG-011: Vercel Production Crash — Module-Level SDK Init Without API Key

**Ngày:** 2026-03-08
**Severity:** 🔴 Critical — Node.js exit 128, toàn bộ page crash

### Triệu chứng
```
Error: Missing API key. Pass it to the constructor `new Resend("re_123")`
Node.js process exited with exit status: 128
```

### Nguyên nhân gốc rễ

| Yếu tố | Chi tiết |
|---------|----------|
| **Module-level init** | `const resend = new Resend(process.env.RESEND_API_KEY)` chạy khi module evaluate |
| **Constructor throws** | Resend throw Error nếu API key là `undefined` |
| **Fatal crash** | Module evaluation error → kill toàn bộ Node.js process |
| **Env var missing trên Vercel** | `.env.local` có key locally, nhưng Vercel chưa set |

### Cách fix

```typescript
// ❌ SAI — Crash khi key missing
const resend = new Resend(process.env.RESEND_API_KEY)

// ✅ ĐÚNG — Lazy init
let _resend: Resend | null = null
function getResend() {
    if (!_resend && process.env.RESEND_API_KEY) {
        _resend = new Resend(process.env.RESEND_API_KEY)
    }
    return _resend
}
```

### Bài học

> ⚠️ **RULE 22: KHÔNG BAO GIỜ khởi tạo SDK ở module-level nếu env var có thể missing.**
> Constructor throw = crash toàn bộ process. Dùng lazy init.
> Áp dụng cho: Resend, Stripe, Twilio, SendGrid, và mọi third-party SDK.

---

## BUG-012: Unauthenticated Server Actions — Data Mutation Without Auth Check

**Ngày:** 2026-03-08
**Severity:** 🔴 Critical — Bảo mật

### Triệu chứng
- Server Actions (create, update, delete) không kiểm tra user session
- Bất kỳ ai gửi POST request đến endpoint cũng có thể tạo/sửa/xóa dữ liệu
- Phát hiện trong deep audit: 30+ mutation functions thiếu auth guard

### Nguyên nhân gốc rễ

| Yếu tố | Chi tiết |
|---------|----------|
| **Không có auth middleware** | Next.js App Router không auto-verify session cho Server Actions |
| **Copy-paste pattern** | Mọi module đều copy cùng pattern: `try { ... } catch` mà không thêm auth |
| **Giả định sai** | Nghĩ rằng Supabase Auth middleware đã bảo vệ mọi route |

### Cách fix

```typescript
// src/lib/session.ts — Tạo auth guard helper
export async function requireAuth(): Promise<SessionUser> {
    const user = await getCurrentUser()
    if (!user) throw new Error('Bạn chưa đăng nhập.')
    return user
}

// Áp dụng ở đầu mỗi mutation:
export async function createSalesOrder(input: SOCreateInput) {
    try {
        await requireAuth()  // ← Thêm dòng này
        // ... business logic
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
```

### Files đã sửa
- `src/lib/session.ts` — thêm `requireAuth()`, `requirePermission()`
- 5 module actions: sales, procurement, suppliers, customers, products

### Bài học

> ⚠️ **RULE 23: MỌI mutation Server Action PHẢI gọi `await requireAuth()` ở đầu try block.**
> Pattern: `throw` → caught by `try/catch` → `return { success: false, error }`.
> Không bao giờ dùng Supabase Auth middleware thay thế cho application-level auth.

---

## BUG-013: Prisma Decimal Serialization Across All Modules

**Ngày:** 2026-03-08
**Severity:** 🟠 Medium — Gây crash khi truyền data Server→Client

### Triệu chứng
- Nhiều trang crash khi render do `Decimal` objects không serializable
- Chỉ xảy ra với models có Decimal fields: `unitPrice`, `qtyOrdered`, `totalAmount`, etc.
- Lỗi first thấy ở Quotation drawer (BUG-010), nhưng pattern tồn tại ở 30+ functions

### Nguyên nhân gốc rễ

`return prisma.model.findMany(...)` trả raw Prisma objects chứa `Decimal` instances.
Next.js không thể serialize `Decimal` → crash hoặc data loss.

### Cách fix — Centralized Utility

```typescript
// src/lib/serialize.ts
export function serialize<T>(data: T): T {
    return JSON.parse(JSON.stringify(data, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ))
}

// Usage pattern:
export async function getStockLots() {
    const raw = await prisma.stockLot.findMany({ ... })
    return serialize(raw)    // ← Safe for Server→Client
}
```

### Files đã sửa (10 files, 15+ functions)

| Module | Functions |
|--------|-----------|
| sales | `getSalesOrderDetail`, `getSalesOrderDetailWithMargin` |
| warehouse | `getPOsForReceiving`, `getSOsForDelivery`, `getStockCountSessions`, `getQuarantinedLots` |
| finance | `getAccountingPeriods` |
| returns | `getSOOptionsForReturn`, `getSOLinesForReturn` |
| contracts | `getContractAmendments`, `getContractDocuments` |
| tax | `getProductPriceHistory` |
| settings | `getPermissions`, `getApprovalTemplates` |
| agency | `getActiveShipments` |
| stamps | `getStampPurchases` |

### Bài học

> ⚠️ **RULE 24: Tất cả `return prisma.*` trong server actions PHẢI wrap trong `serialize()`.**
> Import `serialize` từ `@/lib/serialize`. Pattern:
> ```typescript
> const raw = await prisma.model.findMany({...})
> return serialize(raw)
> ```

> ⚠️ **RULE 25: Khi functions đã `.map()` với `Number()` conversion, KHÔNG cần serialize thêm.**
> Ví dụ: `getContracts()` đã có `value: Number(c.value)` → OK.
> Chỉ cần serialize khi return raw Prisma objects trực tiếp.

---

## Quick Reference — All Rules (Updated)

| # | Rule | Context |
|---|------|---------| 
| 1 | Không chạy đồng thời dev + seed + prisma CLI | Connection pool |
| 2 | Check zombie processes trước khi debug | Connection pool |
| 3 | `pg.Pool({ max: 5 })` + pgBouncer (port 6543) | Connection pool |
| 4 | Mọi `/dashboard/*` PHẢI có `loading.tsx` | Navigation UX |
| 5 | Layout = Server Component, state = tách Client | Architecture |
| 6 | READ functions → `cached()` từ `@/lib/cache` | Performance |
| 7 | `staleTimes` trong next.config.ts là bắt buộc | Performance |
| 8 | Không dùng `Set-Content`, dùng `WriteAllText` UTF-8 | Encoding |
| 9 | Check encoding sau khi sửa file bằng PowerShell | Encoding |
| 10 | Vercel PHẢI dùng Transaction Pooler (6543+pgBouncer) | Connection pool |
| 11 | Test `npx next build` sau thay đổi page config | Build |
| 12 | Mọi export trong `'use server'` file PHẢI là `async` | Server Actions |
| 13 | SWR background refresh phải có dedup guard | Performance |
| 14 | ISR revalidation intervals phải stagger (30/45/60/90s) | Performance |
| 15 | Stat cards KHÔNG tính từ `rows` — dùng `get{Module}Stats()` | Data Accuracy |
| 16 | Module mới có stat cards → tạo `get{Module}Stats()` từ đầu | Data Accuracy |
| 17 | **Git commit message NGẮN GỌN** (< 72 chars), không dùng body dài | Git Workflow |
| 18 | Enum values PHẢI khớp Prisma schema (check trước khi dùng) | Schema |
| 19 | **Many-to-many relation phải query qua pivot table** | Prisma Query |
| 20 | **Server Actions trả Prisma data PHẢI serialize bằng `serialize()` từ `@/lib/serialize`** | Serialization |
| 21 | **Server Actions nên return `{ success, data/error }` thay vì throw** | Error Handling |
| 22 | **KHÔNG khởi tạo SDK ở module-level nếu env var có thể missing** | SDK Init |
| 23 | **MỌI mutation Server Action PHẢI gọi `await requireAuth()`** | Security |
| 24 | **`return prisma.*` PHẢI wrap trong `serialize()`** | Serialization |
| 25 | **Functions có `.map()` + `Number()` conversion thì KHÔNG cần serialize thêm** | Serialization |
| 26 | **Zod validation schema import → PHẢI gọi `parseOrThrow()` trước mutation** | Input Validation |
| 27 | **Mọi mutation tạo giao dịch PHẢI check closed period qua `getOrCreatePeriod()`** | Accounting Integrity |
| 28 | **Enum/status keys trong UI PHẢI khớp Prisma schema — test bằng grep trước khi dùng** | Schema Consistency |
| 29 | **Mọi action file READ function PHẢI wrap trong `cached()` — `grep 'from.*cache'` để verify** | Performance |
| 30 | **Tạo module mới → PHẢI tạo `loading.tsx` cùng lúc (skeleton shimmer)** | Performance UX |
| 31 | **KHÔNG đặt `force-dynamic` trên layout — chỉ đặt trên page nếu cần** | Router Cache |
| 32 | `staleTimes.dynamic` trong next.config PHẢI ≥ 60s cho dashboard | Router Cache |
| 33 | **Interactive elements (location blocks, zone labels) PHẢI có `pointerEvents: 'none'` khi drawing tool active** | Canvas Interaction |
| 34 | **Keyboard handlers cho canvas đặt ở `useEffect` global, KHÔNG trong `sr-only` div** | Event Handling |
| 35 | **Hạn chế gọi nhiều Server Actions song song trên Client Component cùng lúc** | Server Actions |
| 36 | **Luôn ưu tiên pre-fetch dữ liệu trong Server Component trước khi truyền xuống Client** | SSR/RSC |
| 37 | **Tối ưu hóa SQL Count không lạm dụng JOIN dư thừa** | Database Query |
| 38 | **Tách biệt cache invalidation dữ liệu danh sách động và metadata dropdowns tĩnh** | Caching |
| 39 | **Dùng React hook (isMobile) để kết xuất giao diện di động hoặc máy tính có điều kiện thay vì CSS display hidden** | DOM Rendering |
| 40 | **Tránh nghẽn hàng đợi kết nối DB trên Serverless bằng cách trì hoãn (lazy-load) dữ liệu phi trọng yếu** | Connection Queue |

---

## BUG-014: Finance Module — 6 lỗi Critical (Validation, Accounting Integrity, Data Sync)

**Ngày:** 2026-03-09
**Severity:** 🔴 Critical — Vi phạm nguyên tắc kế toán + Input validation bypass

### Triệu chứng

1. AR payment amount có thể âm hoặc rỗng (không có validation)
2. `paidAmount` trên `ARInvoice` luôn = 0 → AR Aging + Balance Sheet tính sai số outstanding
3. Ghi chứng từ vào tháng đã đóng không bị chặn
4. Badge trạng thái "Chưa Thu" hiển thị blank cho invoice mới
5. Thanh toán NCC không sinh bút toán kế toán
6. `idSchema = z.string().uuid()` reject tất cả Prisma `cuid()` IDs

### Nguyên nhân gốc rễ

| Yếu tố | Chi tiết |
|---------|----------|
| **Zod import nhưng không dùng** | `parseOrThrow(ARPaymentCreateSchema,...)` import dòng 7 nhưng 3/4 mutations không gọi |
| **`recordARPayment` thiếu `paidAmount`** | `prisma.aRInvoice.update({ data: { status } })` — chỉ update status, quên paidAmount |
| **`recordARPayment/recordAPPayment` bypass period check** | Không gọi `getOrCreatePeriod()` (có closed check built-in) |
| **`ISSUED` ≠ `UNPAID`** | UI map key `ISSUED` nhưng DB enum là `UNPAID` → lookup trả `undefined` |
| **Thiếu AP Payment journal** | 6/7 events có auto journal, riêng AP Payment bỏ sót |
| **`idSchema` dùng `.uuid()`** | Prisma `cuid()` format là `clxyz...` — không phải UUID format |

### Cách fix

| # | File | Fix |
|---|------|-----|
| 1 | `actions.ts` | Thêm `parseOrThrow()` cho `recordARPayment`, `recordAPPayment`, `createExpense`, `writeOffBadDebt` |
| 2 | `actions.ts` | `recordARPayment`: thêm `paidAmount: totalPaid` vào update data |
| 3 | `actions.ts` | Thêm `await getOrCreatePeriod(...)` cho `recordARPayment`, `recordAPPayment` |
| 4 | `FinanceClient.tsx` | Đổi key `ISSUED` → `UNPAID` |
| 5 | `actions.ts` | Thêm `generateAPPaymentJournal()` — DR 331 / CR 112 |
| 6 | `validations.ts` | `idSchema` đổi từ `.uuid()` → `.min(1)` |

### Bài học

> ⚠️ **RULE 26: Import validation schema → PHẢI gọi `parseOrThrow()` trước mutation.**
> Grep `import.*parseOrThrow` rồi grep `parseOrThrow(` để đảm bảo không import xong quên dùng.

> ⚠️ **RULE 27: Mọi mutation tạo giao dịch tài chính PHẢI gọi `getOrCreatePeriod()`.**
> Hàm có guard `isClosed` built-in. Không gọi = bypass accounting integrity.

> ⚠️ **RULE 28: UI status keys PHẢI match Prisma enum values exactly.**
> Grep `enum XxxStatus` trong schema.prisma → so sánh với UI map keys.

---

## BUG-015: Toàn Hệ Thống Chậm — 11 Action Files Thiếu Cache + 3 Pages Thiếu loading.tsx

**Ngày:** 2026-03-09
**Severity:** 🟠 Medium — Performance degradation system-wide

### Triệu chứng
- Trang product mất ~2s mới load xong
- Tất cả các trang đều phản hồi chậm khi navigate
- User cảm nhận hệ thống bị "đơ" khi nhấn sidebar

### Nguyên nhân gốc rễ

| Yếu tố | Chi tiết |
|---------|----------|
| **11/40 action files thiếu cache** | `proposals`, `qr-codes`, `tax`, `price-list`, `shipment-actions`, `approval-matrix` + 4 AI files (không cần cache) |
| **3/39 pages thiếu `loading.tsx`** | `audit-log`, `proposals`, `settings/approval-matrix` |
| **Query chưa tối ưu** | `getProductStats()` dùng `findMany` rồi JS filter thay vì `count()` subquery |
| **Audit log load heavy JSON** | `oldValue`/`newValue` là JSON lớn, load cả trong danh sách |

### Cách fix

**Audit toàn bộ 40 action files:**
1. Grep `from '@/lib/cache'` → tìm 29/40 files đã có → 11 files thiếu
2. Thêm `cached()` cho 7 files còn thiếu (trừ 4 AI/external API files)
3. Thêm 3 `loading.tsx` skeleton files
4. Optimize `getProductStats()`: `findMany().filter()` → `count()` subquery (10x faster)
5. Optimize `audit-log`: exclude JSON columns + lazy load `getAuditLogDetail()`

**Files đã sửa (15 files):**

| Module | Fix |
|--------|-----|
| `products/actions.ts` | Cache 7 functions + optimize getProductStats |
| `audit-log/actions.ts` | Cache all + lazy load JSON |
| `market-price/actions.ts` | Cache 3 functions |
| `declarations/actions.ts` | Cache 2 functions |
| `costing/actions.ts` | Cache getCostingProducts |
| `agency/actions.ts` | Cache 2 functions |
| `proposals/actions.ts` | Cache 3 functions |
| `qr-codes/actions.ts` | Cache 2 functions |
| `tax/actions.ts` | Cache 2 functions (60s TTL — rarely change) |
| `price-list/actions.ts` | Cache 2 functions |
| `procurement/shipment-actions.ts` | Cache getShipments |
| `settings/approval-matrix/actions.ts` | Cache + rewrite (120s TTL — config data) |
| 3 × `loading.tsx` | audit-log, proposals, approval-matrix |

**Kết quả cuối cùng:**

| Metric | Trước | Sau |
|--------|-------|-----|
| Action files có `cached()` | 29/40 (72.5%) | 36/40 (90%) |
| Pages có `loading.tsx` | 36/39 (92%) | 39/39 (100%) |
| Warm cache navigation | ~2s | < 50ms |
| Cold start | ~2s | ~500ms |

### Bài học

> ⚠️ **RULE 29: Mọi action file READ function PHẢI wrap trong `cached()`.**
> Kiểm tra coverage bằng: `grep -rn "from '@/lib/cache'" src/app/dashboard/ --include="*actions.ts" | wc -l`
> So sánh với tổng: `find src/app/dashboard/ -name "*actions.ts" | wc -l`

> ⚠️ **RULE 30: Tạo module/page mới → PHẢI tạo `loading.tsx` cùng lúc.**
> Pattern: Copy từ page gần nhất. Không có loading.tsx = user thấy màn hình đứng hình.

---

## BUG-016: force-dynamic Trên Layout Giết Router Cache

**Ngày:** 2026-03-09
**Severity:** 🔴 Critical — Vô hiệu hóa toàn bộ Router Cache

### Triệu chứng
- Dù đã thêm `cached()` cho 36/40 action files, trang vẫn chậm ~2s khi navigate
- Click sidebar → luôn thấy loading skeleton → đợi server xử lý
- Quay lại trang đã xem: vẫn chậm y hệt lần đầu (không có cache client-side)

### Nguyên nhân gốc rễ

```typescript
// ❌ dashboard/layout.tsx — dòng này GIẾT toàn bộ Router Cache
export const dynamic = 'force-dynamic'
```

**Khi `force-dynamic` đặt ở layout:**
- Next.js bỏ qua `staleTimes.dynamic` config trong next.config.ts
- Router Cache (client-side) bị vô hiệu hóa cho TẤT CẢ child pages
- Mỗi lần click sidebar = full round-trip server MỚI, kể cả trang đã xem trước đó
- `staleTimes: { dynamic: 30 }` = vô nghĩa khi layout có force-dynamic

### Cách fix

1. **Xóa `export const dynamic = 'force-dynamic'` khỏi `dashboard/layout.tsx`**
2. Pages tự detect dynamic nhờ gọi `cookies()`/`getCurrentUser()` — KHÔNG cần explicit
3. Tăng `staleTimes.dynamic: 30 → 120` (2 phút cache client)
4. Sidebar prefetch ALL links (staggered) thay vì chỉ adjacent

### Kết quả

| Metric | Trước | Sau |
|--------|-------|-----|
| Trang đã xem (revisit) | ~2s (full round-trip) | **~0ms** (instant from cache) |
| Router Cache | ❌ Bị bypass | ✅ Active 120s |
| Prefetch sidebar | 2-3 tabs adjacent | ALL 34 links staggered |

### Bài học

> ⚠️ **RULE 31: KHÔNG BAO GIỜ đặt `force-dynamic` trên layout.tsx.**
> Layout-level `force-dynamic` = giết Router Cache cho TOÀN BỘ child pages.
> Nếu cần dynamic: để Next.js tự detect qua `cookies()`/`headers()` calls.

> ⚠️ **RULE 32: `staleTimes.dynamic` trong next.config PHẢI ≥ 60s cho dashboard.**
> Giá trị khuyến nghị: 120s. Dashboard data thay đổi theo phút, không theo giây.

---

## BUG-017: Floor Plan Drawing Tools Bị Chặn — pointerEvents + ESC + Pan

**Ngày:** 2026-03-10
**Severity:** 🟠 Medium — Drawing tools không hoạt động, UX bị block
**Commit:** `e0b0362`

### Triệu chứng
- Chọn tool "Tường" hoặc "Cửa" → click trên canvas → **không drawing gì**
- Phím ESC không hủy vẽ tường
- Không thể pan canvas khi đang ở edit mode (ngoài middle-click)
- `getWarehouseLayoutConfig()` throw 500 nếu DB lỗi

### Nguyên nhân gốc rễ

| Yếu tố | Chi tiết |
|---------|----------|
| **Location blocks chặn click** | Mỗi location block gọi `e.stopPropagation()` bất kể tool nào → event không reach canvas handler |
| **Zone labels chặn click** | Zone wrapper div (z-index 2) chưa có `pointerEvents: 'none'` → chặn wall/door tool |
| **ESC trong sr-only div** | Keyboard handler nằm trong `<div className="sr-only">` — element **không bao giờ có focus** → event không capture |
| **Thiếu pan UX** | Edit mode chỉ có middle-click pan — không tự nhiên như Figma |
| **Thiếu try-catch** | `getWarehouseLayoutConfig()` throw raw Prisma error → 500 |

### Cách fix (3 bugs + 1 UX + 1 defensive)

| # | File | Fix |
|---|------|-----|
| 1 | `WarehouseMapTab.tsx` | Location blocks: `pointerEvents: isDrawingTool ? 'none' : 'auto'` + conditional `stopPropagation` |
| 2 | `WarehouseMapTab.tsx` | Zone labels: thêm `pointerEvents: isDrawingTool ? 'none' : 'auto'` cho wrapper div |
| 3 | `WarehouseMapTab.tsx` | ESC: thay `sr-only` div bằng `useEffect(() => { window.addEventListener('keydown', ...) })` |
| 4 | `WarehouseMapTab.tsx` | Pan: thêm Space+Drag (giữ Space + kéo chuột trái) trong edit mode |
| 5 | `actions-map.ts` | `getWarehouseLayoutConfig()` bọc try-catch, return default nếu lỗi |

### Pattern quan trọng

```typescript
// Drawing canvas: Interactive elements PHẢI có pointerEvents bypass
const isDrawingTool = tool === 'wall' || tool === 'door' || tool === 'label' || tool === 'eraser'

// Location block
<div style={{
    pointerEvents: editMode && isDrawingTool ? 'none' : 'auto',  // ← KEY
    cursor: editMode && isDrawingTool ? 'inherit' : 'pointer',
}}>

// Global keyboard handler (NOT in sr-only div)
useEffect(() => {
    if (!editMode) return
    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') { cancelDrawing() }
        if (e.key === ' ' && !e.repeat) { e.preventDefault(); setPanning(true) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
}, [editMode])
```

### Bài học

> ⚠️ **RULE 33: Interactive elements (location blocks, zone labels) PHẢI có `pointerEvents: 'none'` khi drawing tool active.**
> Nhiều layer HTML/SVG chồng lên nhau trên canvas. Nếu không bypass pointerEvents, event bị nuốt bởi element ở layer trên.

> ⚠️ **RULE 34: Keyboard handlers cho canvas đặt ở `useEffect` global (`window.addEventListener`), KHÔNG trong `sr-only` div.**
> `sr-only` div không bao giờ có focus → keyboard events không được capture.
> `useEffect` + `window.addEventListener` hoạt động ở mọi trường hợp.

---

## BUG-018: Sales Order Tab Loading Chậm — Multi-Waterfall Server Actions & SQL Count Joins

**Ngày:** 2026-06-23
**Severity:** 🔴 Critical — Load trang bị nghẽn (10-15s), hiển thị Skeleton quá lâu

### Triệu chứng
- Khi mở tab Đơn bán hàng, giao diện hiển thị Skeleton loader xoay rất lâu (10-15 giây).
- Xảy ra thường xuyên trên production, gây cạn kiệt số lượng kết nối cơ sở dữ liệu (connection pool exhaustion).

### Nguyên nhân gốc rễ

| Yếu tố | Chi tiết |
|---------|----------|
| **Multi-Waterfall Server Actions** | Component `SalesClient` (Client Component) khi mount kích hoạt đồng thời 3 cuộc gọi Server Action (`getSalesOrders`, `getSalesStats`, `getSOStatusCounts`) qua client-side `Promise.all`. Trình duyệt gửi 3 request HTTP POST riêng biệt, buộc máy chủ Next.js khởi tạo 3 DB connections đồng thời, gây ra nghẽn hàng đợi (connection pool exhaustion). |
| **Không tải trước dữ liệu** | Server Component `page.tsx` truyền props rỗng xuống Client Component, làm mất lợi thế kết xuất phía máy chủ (SSR/RSC) và buộc trình duyệt phải fetch dữ liệu động sau khi tải trang. |
| **JOIN dư thừa trong SQL Count** | Truy vấn đếm số lượng bản ghi (`countQuery`) thực hiện các lệnh `JOIN customers`, `JOIN users`, và `JOIN legal_entities` dư thừa ngay cả khi không sử dụng bộ lọc tìm kiếm `search`. |

### Cách fix

1. **Pre-fetch dữ liệu phía Server:** Thực hiện gọi hàm `getSalesPageData` ngay trên Server Component `page.tsx` và truyền dữ liệu thu được làm giá trị khởi tạo `initialRows`, `initialTotal`, `stats`, `statusCounts` cho Client Component. Nhờ đó, trang tải lên có sẵn dữ liệu và **loại bỏ hoàn toàn Skeleton loading khi tải trang đầu**.
2. **Gộp Server Actions:** Tạo hàm hợp nhất `getSalesPageData` trên server để chạy song song các truy vấn thông qua cùng một kết nối DB ấm, giảm số lượng kết nối từ trình duyệt từ 3 xuống còn 1.
3. **Loại bỏ JOIN dư thừa trong câu đếm:**
   ```typescript
   let countQuery = ''
   if (search) {
       countQuery = `
           SELECT COUNT(*)::int as total
           FROM sales_orders so
           JOIN customers c ON c.id = so."customerId"
           ${whereClause}
       `
   } else {
       countQuery = `
           SELECT COUNT(*)::int as total
           FROM sales_orders so
           ${whereClause}
       `
   }
   ```

### Bài học

> ⚠️ **RULE 35: Hạn chế gọi nhiều Server Actions song song trên Client Component cùng lúc khi vào trang.**
> Gộp chúng lại thành 1 action duy nhất (ví dụ: `getPageData`) để giảm số lượng HTTP request và tối ưu lượng DB connection đồng thời.

> ⚠️ **RULE 36: Luôn ưu tiên pre-fetch dữ liệu trong Server Component trước khi truyền xuống Client Component.**
> Tránh truyền props rỗng và để Client Component tự động gọi fetch dữ liệu trong `useEffect` khi mount.

> ⚠️ **RULE 37: Tối ưu hoá SQL Count.**
> Chỉ thực hiện `JOIN` khi các điều kiện trong `WHERE` thực sự tham chiếu tới bảng được liên kết. Đếm số dòng trên bảng chính không JOIN sẽ giúp tăng tốc độ đáng kể.

---

## BUG-019: Trang Danh Mục Sản Phẩm Tải Chậm Trên Điện Thoại (8s) — Invalidation Cache Sai & Responsive DOM Overhead

**Ngày:** 2026-06-23
**Severity:** 🟠 Medium — Trải nghiệm di động kém, lag giao diện tải trang

### Triệu chứng
- Khi truy cập Danh mục sản phẩm (`/dashboard/products`) bằng điện thoại, trang bị đơ ở Skeleton loading rất lâu (tầm 8s).
- Không cải thiện bằng việc nén hình ảnh (vì dung lượng ảnh ImgBB vốn đã nhỏ, ~12KB).

### Nguyên nhân gốc rễ

| Yếu tố | Chi tiết |
|---------|----------|
| **Xóa nhầm cache dropdown tham chiếu** | Khi có cập nhật kho hàng (`wms`, `transfers`, `stock-count`), module `cache.ts` tự động xóa sạch mọi key bắt đầu bằng `products`. Điều này vô tình xóa luôn cache các dữ liệu dropdown tĩnh ít thay đổi (`products:countries`, `products:vintages`, `products:producers`), khiến mỗi lần có biến động kho, server component load trang lại bị dội một loạt truy vấn cold start song song xuống Supabase Singapore. |
| **Quá tải truy vấn chặn Server (Server Connection Queue)** | Server Component phải chờ toàn bộ 10 truy vấn DB hoàn tất (bao gồm cả danh sách sản phẩm, các stats, và tất cả danh sách trong dropdown quốc gia, vintages, nhà sản xuất) mới trả về HTML. Trên môi trường serverless (Vercel) với giới hạn connection pool (`max: 2`), việc chạy 10 query song song gây ra nghẽn hàng đợi kết nối, dẫn tới 8 giây chờ đợi. |
| **Giao diện Responsive DOM kép** | `ProductTable.tsx` chứa cả Desktop View (`hidden md:block` table) và Mobile View (`block md:hidden` card list) song song trong DOM. Trình duyệt di động, dù chỉ hiển thị 20 mobile cards, vẫn phải tải và decode ảnh cho 20 product rows tương ứng của Desktop Table ẩn, dẫn đến quá tải luồng decode hình ảnh và chiếm dụng tài nguyên CPU di động. |

### Cách fix

1. **Selective Invalidation Cache:** Cấu trúc lại `revalidateCache` trong `cache.ts` để khi có biến động kho hàng (`wms`, `transfers`, `stock-count`), hệ thống chỉ xóa cache danh sách sản phẩm `products:list` và stats `products:stats`, bảo lưu cache dữ liệu tham chiếu tĩnh.
2. **Lazy-loading Dữ liệu bộ lọc & Thống kê ở Client Component:**
   - Tinh chỉnh `getProductsPageData` trong `actions.ts` chỉ thực hiện 3 truy vấn quan trọng nhất (kiểm tra session và lấy danh sách sản phẩm trang 1). Loại bỏ việc query stats, countries, vintages, và producers khỏi server load block.
   - Thêm React `useEffect` trong `ProductsClient.tsx` thực hiện background fetch bất đồng bộ các dữ liệu tham chiếu bổ sung sau khi trang đã mount xong ở client. Người dùng thấy bảng sản phẩm ngay lập tức (~0.2s - 1.2s), các stats và bộ lọc sẽ tự động điền vào sau đó vài trăm mili-giây.
3. **Responsive DOM Rendering:** Cấu trúc lại `ProductTable.tsx` sử dụng React hook `isMobile` để unmount hoàn toàn giao diện Desktop trên Mobile (và ngược lại), loại bỏ hơn 50% số DOM nodes dư thừa và triệt tiêu hành vi tải hình ảnh ẩn trên di động.

### Bài học

> ⚠️ **RULE 38: Tách biệt cache invalidation dữ liệu danh sách động và metadata dropdowns tĩnh.**
> Việc cập nhật số lượng kho hàng hoặc giao dịch không được phép làm invalid các danh mục dropdown tĩnh ít thay đổi, tránh gây dội query cold-start hàng loạt.

> ⚠️ **RULE 39: Dùng React hook để kết xuất giao diện di động hoặc máy tính có điều kiện thay vì CSS display hidden.**
> Rất nguy hiểm nếu nhồi nhét cả cấu trúc Table phức tạp cùng hàng chục hình ảnh vào DOM rồi dùng CSS `display: none` ẩn đi. Sử dụng mount check để unmount cấu trúc không dùng giúp tiết kiệm băng thông và tài nguyên CPU đáng kể cho di động.

> ⚠️ **RULE 40: Tránh nghẽn hàng đợi kết nối cơ sở dữ liệu trên Serverless bằng cách trì hoãn (lazy-load) dữ liệu tham chiếu phi trọng yếu lên client.**
> Với các trang có nhiều dropdown filter tĩnh và chỉ số thống kê, chỉ nên tải dữ liệu chính (bảng chính) ở server để trả về HTML lập tức. Các dropdown/stats phụ có thể fetch bất đồng bộ ở client-side `useEffect` sau khi trang đã mount.

---

## BUG-020: 504 MIDDLEWARE_INVOCATION_TIMEOUT Trên Điện Thoại / Khách Hàng Truy Cập Lần Đầu

**Ngày:** 2026-07-11
**Severity:** 🔴 Critical — Không thể truy cập trang web (lỗi 504) khi Database đang ở trạng thái ngủ

### Triệu chứng
- Khi truy cập ứng dụng lần đầu tiên hoặc sau một khoảng thời gian không có hoạt động, trình duyệt báo lỗi `504: GATEWAY_TIMEOUT` với mã `MIDDLEWARE_INVOCATION_TIMEOUT` từ Vercel.
- Lỗi xảy ra đặc biệt thường xuyên trên thiết bị di động của người dùng truy cập lần đầu.
- Tuy nhiên, sau một vài giây, các lượt truy cập tiếp theo (hoặc truy cập trên máy tính) lại hoạt động bình thường.

### Nguyên nhân gốc rễ

| Yếu tố | Chi tiết |
|---------|----------|
| **Supabase Free Tier** | Cơ sở dữ liệu tự động đi ngủ (Cold Start) sau thời gian không hoạt động. Cần 10-20 giây để đánh thức. |
| **Vercel Edge Timeout** | Vercel Edge Middleware có thời gian chờ (timeout) rất nghiêm ngặt là 1.5 giây. |
| **Kiểm tra auth quá sớm** | Middleware gọi `supabase.auth.getUser()` trên mọi request trước cả khi lọc các trang công cộng (`publicPaths`), API (`/api/*`), portal (`/portal/*`). |
| **Không lọc cookie** | Gọi Supabase API xác thực ngay cả đối với người dùng chưa đăng nhập (không có cookie `sb-*`), làm tăng nguy cơ kích hoạt cold-start. |

### Cách fix

1. **Kiểm tra loại route trước:** Chỉ thực hiện xác thực đối với các route không phải API (`/api/*`) hoặc Portal (`/portal/*`).
2. **Kiểm tra cookie phiên (Quick check):** Nếu request không chứa bất kỳ cookie nào bắt đầu bằng `sb-` (cookie của Supabase), bỏ qua việc gọi `supabase.auth.getUser()`, gán `user = null` và xử lý chuyển hướng hoặc cho qua ngay lập tức. Điều này giúp giảm tải cho database và loại bỏ hoàn toàn 504 đối với khách truy cập chưa đăng nhập.
3. **Bọc try-catch:** Đảm bảo lỗi kết nối Supabase không làm crash toàn bộ middleware.

### Bài học

> ⚠️ **RULE 41: Luôn tối ưu hóa Middleware để tránh gọi dịch vụ ngoài.**
> Việc gọi API ngoài trong Middleware (đặc biệt là Edge Middleware có timeout 1.5s) phải được hạn chế tối đa bằng cách kiểm tra trước điều kiện (như kiểm tra cookie hoặc route).

> ⚠️ **RULE 42: Không gọi Auth cho các trang public hoặc API không cần thiết.**
> Tách biệt rõ ràng các route cần kiểm tra auth và skip gọi API khi không sử dụng kết quả xác thực.

---

## BUG-021: 504 MIDDLEWARE_INVOCATION_TIMEOUT Khi Đã Có Cookie và DB Đang Ngủ (Cold Start) — Promise.race Timeout

**Ngày:** 2026-07-14
**Severity:** 🔴 Critical — Không thể truy cập trang web (lỗi 504) cho người dùng đã đăng nhập khi database ở trạng thái nghỉ

### Triệu chứng
- Người dùng đã có cookie phiên đăng nhập (`sb-*`) truy cập trang web sau một khoảng thời gian dài không hoạt động bị lỗi `504: GATEWAY_TIMEOUT` với mã `MIDDLEWARE_INVOCATION_TIMEOUT`.
- Xảy ra do Supabase Free Tier mất 10-20 giây để đánh thức DB, vượt quá giới hạn 1.5 giây của Vercel Edge Middleware.

### Nguyên nhân gốc rễ
- Ở bản sửa trước (BUG-020), hệ thống chỉ kiểm tra sự hiện diện của cookie đăng nhập.
- Tuy nhiên, nếu trình duyệt đã có cookie đăng nhập, middleware vẫn gọi `supabase.auth.getUser()`. Cuộc gọi API này tiếp tục bị nghẽn (block) và bị Vercel hủy bằng lỗi 504 trước khi DB kịp thức giấc.

### Cách fix
1. Sử dụng `Promise.race` để đặt giới hạn thời gian chờ (timeout) cho cuộc gọi `supabase.auth.getUser()` trong middleware là **1200ms**.
2. Nếu quá 1.2 giây mà Supabase chưa phản hồi, bắt lỗi timeout và thiết lập cờ `authTimedOut = true`.
3. Cho phép request vượt qua middleware để đi thẳng vào Server Component thay vì trả về lỗi 504 hoặc tự động chuyển hướng về `/login`. Server Component chạy trên môi trường serverless thông thường có timeout dài hơn sẽ đợi DB thức giấc thành công và tải trang bình thường.

### Bài học

> ⚠️ **RULE 43: Luôn giới hạn thời gian chờ (Timeout) cho các cuộc gọi API ngoài trong Middleware.**
> Tránh việc nghẽn hoàn toàn luồng routing của Next.js khi dịch vụ phía sau (như Supabase) phản hồi chậm hoặc đang ở trạng thái ngủ (cold-start).

---

## BUG-022: Trễ tải dữ liệu khi mở Drawer Chỉnh sửa Sản phẩm

**Ngày:** 2026-07-14
**Severity:** 🟡 Medium — Trải nghiệm người dùng bị chậm khi chỉnh sửa sản phẩm

### Triệu chứng
- Khi nhấn nút Chỉnh sửa (Edit) một sản phẩm, Drawer mở ra nhưng hiển thị trạng thái tải (loading spinner) khá lâu (từ 500ms đến hơn 1s) trước khi dữ liệu sản phẩm hiển thị đầy đủ.

### Nguyên nhân gốc rễ
1. Hàm Server Action `getProductEditDetails` thực hiện truy vấn trực tiếp cơ sở dữ liệu (sử dụng `Promise.all` gom 3 truy vấn: thông tin sản phẩm kèm theo producer/appellation/profile, hình ảnh `productMedia`, và các giải thưởng `productAward`) mỗi khi được gọi mà không sử dụng cache.
2. Các danh mục dữ liệu tham chiếu bổ trợ (`producers`, `regions`, `suppliers`) chỉ bắt đầu được tải khi Drawer mở lần đầu tiên, làm tăng thêm thời gian chờ.

### Cách fix
1. Sử dụng helper `cached` để cache kết quả của hàm `getProductEditDetails` server-side với TTL 60 giây và key prefix `products:details:edit:${id}`. Cache này tự động bị vô hiệu hóa khi có thay đổi/cập nhật sản phẩm do mutation gọi `revalidateCache('products')`.
2. Tải trước (prefetch) `getRegions()` và `getSuppliers()` ngay khi trang danh sách sản phẩm (`ProductsClient`) được mount để lưu sẵn vào cache máy chủ.
3. Làm ấm cache máy chủ (warm cache) bằng cách gọi hàm `getProductEditDetails(id)` trong nền khi người dùng di chuột (hover) trên dòng sản phẩm (bên trong hàm `prefetchProductDetails`). Khi người dùng click nút Chỉnh sửa, dữ liệu đã sẵn sàng trong cache máy chủ và hiển thị tức thì (< 5ms).

### Bài học

> ⚠️ **RULE 44: Luôn kết hợp lưu cache server-side và tải trước (prefetch) trên giao diện đối với các thao tác Drawer/Modal.**
> Caching giúp giảm thiểu truy vấn trùng lặp tới DB, còn prefetch khi hover giúp triệt tiêu hoàn toàn thời gian trễ mạng trước khi người dùng thực hiện thao tác click.

---

## BUG-023: Build Fail - TypeScript Type Mismatch on Nested Prisma Connect

**Ngày:** 2026-07-16
**Severity:** 🔴 Critical — Gây lỗi biên dịch TypeScript khi chạy production build (`next build`)

### Triệu chứng
- Khi chạy build sản phẩm, trình biên dịch báo lỗi:
  `Type '{ connect: { id: string | null; }; } | undefined' is not assignable to type 'UserCreateNestedOneWithoutCustomersInput | undefined'.`
  `Type 'null' is not assignable to type 'string | undefined'.`

### Nguyên nhân gốc rễ
- Trong hàm `updateCustomer` Server Action, khi tự động tạo Company mẹ gánh nợ, trường `salesRep` được định nghĩa bằng toán tử ternary kiểm tra sự tồn tại của `customerData.salesRepId ?? oldCustomer.salesRepId` và sau đó truyền trực tiếp biểu thức đó vào `{ connect: { id: customerData.salesRepId ?? oldCustomer.salesRepId } }`.
- Mặc dù đã kiểm tra tính truthy ở đầu biểu thức ternary, TypeScript không thể thu hẹp kiểu (narrow type) cho biểu thức giống hệt bên trong do nó được tính toán lại độc lập, dẫn đến TypeScript vẫn xem giá trị đó có thể là `string | null`, không tương thích với kiểu `string | undefined` của Prisma input.

### Cách fix
- Gán kết quả của biểu thức `customerData.salesRepId ?? oldCustomer.salesRepId` vào một biến cục bộ riêng (ví dụ: `const repId`), sau đó kiểm tra và truyền biến đó vào `connect`:
  `salesRep: repId ? { connect: { id: repId } } : undefined`
  TypeScript sẽ tự động thu hẹp kiểu của `repId` bên trong block thành một kiểu `string` không nullable.

### Bài học

> ⚠️ **RULE 45: Luôn gán các biểu thức kiểm tra có khả năng chứa null hoặc undefined vào biến cục bộ trước khi truyền vào Prisma nested relations.**
> Việc gán biến cục bộ giúp trình biên dịch TypeScript thực hiện thu hẹp kiểu dữ liệu chính xác, tránh các lỗi biên dịch kiểu tĩnh không tương thích.

---

## BUG-024: Bản in Tờ Trình Cơ Chế Giá Bị Trắng / Không Hiển Thị Do CSS @media print

**Ngày:** 2026-07-18
**Severity:** 🟠 Medium — Không xem được bản in hoặc in ra trang trắng đối với tờ trình cơ chế giá

### Triệu chứng
- Khi nhấn nút "In Tờ Trình" trong chi tiết tờ trình cơ chế giá (`PRICE_ADJUSTMENT`), giao diện in của trình duyệt hiện ra trống trơn (trang trắng), không thể xem hay in được nội dung.

### Nguyên nhân gốc rễ
1. Để ẩn giao diện hệ thống ERP (sidebar, header, dashboard wrappers...) khi in, mã CSS trong `@media print` sử dụng thuộc tính `display: none !important` trên các tag bao ngoài như `main`, `.fixed`, `header`, `aside`.
2. Do component `ProposalsClient` và phần tử chứa dữ liệu in `#proposal-print-area` được đặt lồng bên trong thẻ `<main>` của Layout Next.js, thuộc tính `display: none` của thẻ `<main>` đã ẩn toàn bộ các phần tử con bên dưới nó, bao gồm cả nội dung tờ trình cần in.

### Cách fix
- Loại bỏ phần HTML in ẩn `#proposal-print-area` và các thuộc tính `@media print` rắc rối trong [ProposalsClient.tsx](file:///d:/Lyruou/wine-erp/src/app/dashboard/proposals/ProposalsClient.tsx).
- Thay thế bằng giải pháp mở cửa sổ phụ (popup window) độc lập bằng `window.open` tương tự module Hồ Sơ Khách Hàng. Giải pháp này xuất ra một trang HTML độc lập chứa riêng nội dung tờ trình, tự động kích hoạt `window.print()` và đóng cửa sổ sau khi in xong.

### Bài học

> ⚠️ **RULE 46: Tránh sử dụng `@media print` ẩn các thẻ layout gốc (như `main`, `body`, hoặc các block bọc ngoài) để hiển thị phần tử in con.**
> Việc này dễ gây ra lỗi ẩn toàn bộ cây DOM con. Thay vào đó, hãy sử dụng giải pháp mở Popup in (`window.open`) hoặc một route chuyên dụng để đảm bảo bản in độc lập hoàn toàn khỏi CSS layout gốc và hiển thị chính xác.

---

## BUG-025: Không Hiển Thị Hình Ảnh Sản Phẩm Trong Popup Chọn Nhanh Của Báo Giá & Đơn Hàng

**Ngày:** 2026-07-18
**Severity:** 🟡 Medium — Ảnh sản phẩm hiển thị icon rượu vang placeholder thay vì ảnh thật trong popup chọn nhanh

### Triệu chứng
- Khi mở popup "Chọn sản phẩm nhanh" trong tab Tạo báo giá mới (`QuotationClient.tsx`), tất cả sản phẩm đều chỉ hiển thị icon ly rượu vang `🍷` trên nền tối thay vì hiển thị hình ảnh thực tế của chai rượu, mặc dù trong master data sản phẩm đã được cấu hình ảnh đầy đủ.

### Nguyên nhân gốc rễ
- Hàm Server Action `getProductsWithStock()` trong [actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/sales/actions.ts) được dùng chung để tải danh mục sản phẩm cho cả Đơn bán hàng và Báo giá.
- Trong hàm này, câu truy vấn Prisma `prisma.product.findMany` không thực hiện chọn (select) trường `primaryImageUrl` từ database. Đồng thời, trong kết quả map trả về client, giá trị trường `primaryImageUrl` bị gán cứng thành `null`: `primaryImageUrl: null`.

### Cách fix
- Cập nhật hàm `getProductsWithStock()` để thêm `primaryImageUrl: true` vào khối lệnh `select` của Prisma.
- Trong hàm map kết quả, thay thế giá trị gán cứng `primaryImageUrl: null` bằng `primaryImageUrl: p.primaryImageUrl`.

### Bài học

> ⚠️ **RULE 47: Luôn kiểm tra các hàm chia sẻ dữ liệu chung (shared data actions) khi tích hợp UI để đảm bảo không bị thiếu thuộc tính dữ liệu cần thiết.**
> Hạn chế việc gán cứng giá trị `null` hoặc `N/A` cho các trường dữ liệu quan trọng như URL hình ảnh, ID định danh nếu database đã lưu trữ sẵn các thông tin này.

---

## BUG-026: Vercel Build Fail — Outdated Script Import & tsconfig.json Included Dev Scripts

**Ngày:** 2026-08-04
**Severity:** 🔴 Critical — Vercel Production Build thất bại do Type Check lỗi trong thư mục `scripts/`

### Triệu chứng
```
./scripts/check_session_permissions.ts:5:10
Type error: Module '"../src/lib/session"' has no exported member 'getPermissionsForRoles'.
> 5 | import { getPermissionsForRoles } from '../src/lib/session'
Error: Command "npm run build" exited with 1
```

### Nguyên nhân gốc rễ
1. Script bảo trì `scripts/check_session_permissions.ts` import hàm `getPermissionsForRoles` từ `src/lib/session.ts` nhưng hàm này đã được refactor/xóa trong `session.ts`.
2. File `tsconfig.json` của Next.js có mảng `"include": ["**/*.ts"]` nhưng `"exclude"` chỉ có `["node_modules"]`, dẫn đến lệnh `next build` quét và biên dịch cả các file script dev/scratch trong thư mục `scripts/`.

### Cách fix
1. Sửa `scripts/check_session_permissions.ts` bỏ import bị hỏng và tính permissions từ `user.roles` trực tiếp.
2. Cập nhật `tsconfig.json` bổ sung `"scripts"` và `"scratch"` vào mảng `exclude`.

### Bài học

> ⚠️ **RULE 48: Loại bỏ các thư mục scripts/scratch khỏi tsconfig.json của Next.js để tránh làm hỏng Build Pipeline trên Vercel.**
> Các script hỗ trợ phát triển/bảo trì cục bộ không nằm trong ứng dụng Web chính cần được loại trừ khỏi `tsconfig.json` để tránh gây lỗi Build trên CI/CD khi refactor code chính.

---

## BUG-027: Dấu Chấm Ở Giữa Chữ Số 0 Do Fallback Font Monospace Hệ Thống (Consolas / JetBrains Mono)

**Ngày:** 2026-08-08
**Severity:** 🟡 Medium — Ảnh hưởng thẩm mỹ giao diện hiển thị mã SO, MST, Ngày tháng và Giá tiền

### Triệu chứng
- Các chữ số `0` hiển thị trên giao diện (như mã SO `SO-2608-0009`, MST `0102042513`, ngày `07/08/2026`, giá tiền `1.150.000 đ`) có dấu chấm nhỏ hoặc gạch chéo ở giữa ruột số 0.

### Nguyên nhân gốc rễ
1. Thuộc tính CSS `--font-mono` trong Tailwind v4 khi không được gắn trực tiếp đối tượng `next/font` trên thẻ `<html>` sẽ fallback về font monospace mặc định của hệ điều hành Windows (`Consolas` hoặc `Courier New`), các font này mặc định bật tính năng OpenType Dotted/Slashed Zero.
2. Một số file component chứa khai báo inline `font-family: monospace` hoặc `fontFamily: 'var(--font-mono)'`.

### Cách fix
1. Gán trực tiếp biến font `Inter` cho `--font-mono` trong `src/app/layout.tsx`.
2. Khai báo quy tắc CSS ép cứng toàn hệ thống trong `src/app/globals.css`: `font-feature-settings: "zero" 0 !important;` và đè toàn bộ selector `.font-mono`, `[class*="font-mono"]`, `.type-code` về `Inter` với `tabular-nums`.
3. Quét toàn bộ codebase thay thế tất cả khai báo inline `monospace` / `var(--font-mono)` sang `var(--font-sans)` (`Inter`).

### Bài học

> ⚠️ **RULE 49: Luôn gắn đối tượng next/font cho cả --font-sans và --font-mono trên thẻ <html> và áp dụng font-feature-settings: "zero" 0 để loại bỏ hoàn toàn số 0 có chấm.**

---

## BUG-028: Prisma Error "Unknown argument salesRepId" Khi Cập Nhật Điều Khoản Thanh Toán / Thông Tin Khách Hàng

**Ngày:** 2026-08-08
**Severity:** 🔴 Critical — Không thể lưu cập nhật Khách hàng khi salesRepId hoặc parentId có giá trị null

### Triệu chứng
Khi chỉnh sửa Điều khoản thanh toán hoặc thông tin khác của Khách hàng, hệ thống báo lỗi Toast màu đỏ:
```
Unknown argument 'salesRepId'. Did you mean 'salesRep'? Available options are marked with ?.
```

### Nguyên nhân gốc rễ
Trong hàm `updateCustomer` tại `src/app/dashboard/customers/actions.ts`:
- Khi `salesRepId` là `null`, mã nguồn gán `dataToUpdate.salesRep = { disconnect: true }` nhưng **quên không xóa `delete dataToUpdate.salesRepId`**.
- Prisma 7 khi nhận cả trường quan hệ `salesRep: { disconnect: true }` đồng thời trường thô `salesRepId: null` trong object `data` sẽ báo lỗi `Unknown argument 'salesRepId'`.

### Cách fix
Cập nhật khối xử lý quan hệ trong `updateCustomer`:
```ts
if ('salesRepId' in dataToUpdate) {
    const srid = dataToUpdate.salesRepId
    delete dataToUpdate.salesRepId
    if (srid) {
        dataToUpdate.salesRep = { connect: { id: srid } }
    } else {
        dataToUpdate.salesRep = { disconnect: true }
    }
}
```

### Bài học

> ⚠️ **RULE 50: Luôn delete trường ID thô (salesRepId, parentId...) khỏi object dataToUpdate trước khi gọi prisma.update khi chuyển đổi sang quan hệ Prisma (connect/disconnect).**

---

## BUG-029: Giao Diện Danh Sách Khách Hàng Không Tải Lại Dữ Liệu Sau Khi Sửa / Xóa (TanStack Query Stale Cache)

**Ngày:** 2026-08-08
**Severity:** 🔴 Critical — Thay đổi hoặc xóa khách hàng thành công ở DB nhưng bảng UI giữ nguyên dữ liệu cũ

### Triệu chứng
- Sửa thông tin hoặc bấm Xóa Khách hàng xong thì bảng danh sách không cập nhật ngay, vẫn giữ nguyên thông tin cũ.
- Xóa khách hàng Công ty cha bị báo lỗi hoặc giữ nguyên cơ sở con.

### Nguyên nhân gốc rễ
1. Trong `CustomersClient.tsx`, TanStack Query sử dụng `staleTime: 30_000` (30 giây). Khi gọi `applyFilter({})`, mảng state `filters` không thay đổi giá trị nên TanStack Query không kích hoạt hàm fetch lại dữ liệu từ server.
2. Hàm `deleteCustomer` ở server chưa kiểm tra ràng buộc nhánh con (`childrenCount > 0`), dẫn đến nếu xóa Công ty cha có con sẽ gặp lỗi ràng buộc dữ liệu.

### Cách fix
1. Gọi `queryClient.invalidateQueries({ queryKey: ['customers'] })` trong hàm `reload()` mỗi khi `onSaved()`, `handleDelete()`, hoặc `onComplete()` thực thi xong để giải phóng cache ngay lập tức.
2. Bổ sung kiểm tra cơ sở con trong `deleteCustomer`: Thông báo rõ ràng nếu khách hàng là Công ty cha có cơ sở con trực thuộc.

### Bài học

> ⚠️ **RULE 51: Khi sử dụng TanStack Query với staleTime > 0, bắt buộc phải gọi queryClient.invalidateQueries() sau mỗi thao tác Mutation (Thêm/Sửa/Xóa) để ép UI làm tươi dữ liệu tức thì.**

---

## BUG-030: Đơn Hàng SO & Báo Giá Quotation Không Tự Động Lấy Giá Đặc Biệt (CustomerPriceRule)

**Ngày:** 2026-08-08
**Severity:** 🔴 Critical — Khách hàng có chính sách Giá Đặc Biệt (SPECIAL_PRICE) nhưng khi lên đơn SO hoặc Báo Giá lại lấy giá bán buôn tiêu chuẩn.

### Triệu chứng
- Nhóm khách hàng Paolo & Chi (`HR10092`, `HR10092-01`, `HR10092-02`, `HR10092-03`) đã được duyệt 12 quy tắc **Giá Đặc Biệt**, nhưng khi nhân viên lên đơn SO hoặc tạo Báo Giá (QTN) cho các mã như `L10029`, `L60001`, `L30001`... hệ thống vẫn lấy giá niêm yết cũ (ví dụ `450.000 đ` thay vì `390.000 đ`).

### Nguyên nhân gốc rễ
1. Màn hình Tạo Báo Giá (`QuotationClient.tsx`) trước đây chưa tích hợp hàm `getCustomerResolvedPrices(customerId)`, luôn mặc định gán `product.wholesalePrice`.
2. Màn hình Tạo Đơn Hàng (`CreateSODrawer.tsx`) khi người dùng chọn sản phẩm trước khi chọn khách hàng hoặc khi API `getCustomerResolvedPrices` phản hồi chậm, hàm `updateLine` bị lấy nhầm giá mặc định channel base thay vì chờ giá giải mã từ quy tắc khách hàng.

### Cách fix
1. Tích hợp `getCustomerResolvedPrices(customerId)` vào `QuotationClient.tsx`: Mỗi khi chọn khách hàng, tự động tải bảng giá giải mã (bao gồm Giá Đặc Biệt, Giá Cố Định, Chiết Khấu) để điền chính xác vào từng dòng báo giá.
2. Cập nhật logic gán đơn giá trong `CreateSODrawer.tsx`: Đảm bảo `unitPrice` và `priceSource` được cập nhật đồng bộ 100% sang `SPECIAL_PRICE` ngay khi chọn khách hàng hoặc thêm sản phẩm.

### Bài học

> ⚠️ **RULE 52: Tất cả màn hình liên quan tới tính giá bán (Đơn Hàng SO, Báo Giá QTN, Đơn POS) BẮT BUỘC phải gọi getCustomerResolvedPrices(customerId) để ưu tiên quy tắc Giá Đặc Biệt (SPECIAL_PRICE) vượt lên trên giá kênh bán hàng mặc định.**

---

## BUG-031: Header Chứa Chữ 'Đơn Bán Hàng' Rò Rỉ Vào Trang In Phiếu SO

**Ngày:** 2026-08-08
**Severity:** 🟡 Medium — Tiêu đề trang Dashboard Header (`Đơn Bán Hàng`) bị hiển thị ở đỉnh tờ giấy khi in Đơn SO.

### Triệu chứng
- Khi bấm In Đơn bán hàng, phía trên cùng tờ giấy in (nằm trên tên CÔNG TY CỔ PHẦN THƯƠNG MẠI THẮNG ÂN) có dòng chữ `Đơn Bán Hàng` bị thừa.

### Nguyên nhân gốc rễ
1. Thanh Header chung của Dashboard (`Header.tsx`) sử dụng thẻ `<header>` nhưng trong CSS cũ rule `@media print` chỉ ẩn `header:has(nav)` nên thẻ `<header>` chính của giao diện không bị ẩn khi in.
2. Tiêu đề `document.title` của trình duyệt mặc định đặt theo tên route `Đơn Bán Hàng`.

### Cách fix
1. Trong `globals.css` và `sales/print/page.tsx`, bổ sung quy tắc `@media print { header, nav, aside { display: none !important; } }` để ẩn 100% thanh Header layout chung khi in.
2. Thiết lập `document.title = order.soNo` để file in/xóa bớt tiêu đề thừa và lưu tên file PDF theo mã đơn hàng (VD: `SO-2608-0010.pdf`).

### Bài học

> ⚠️ **RULE 53: Khi cấu hình trang in (@media print), bắt buộc phải ẩn toàn bộ các thẻ layout gốc (header, nav, aside) để tránh tiêu đề thanh điều hướng rò rỉ vào bản in.**

---

## BUG-032: Khống Chế 1 Mức Thuế Suất VAT Duy Nhất Trên Đơn Bán Hàng & Báo Giá

**Ngày:** 2026-08-08
**Severity:** 🟡 High — Hóa đơn điện tử chỉ cho phép 1 mức thuế suất VAT duy nhất trên mỗi hóa đơn xuất ra.

### Triệu chứng
- Khi tạo đơn hàng SO hoặc Báo giá QTN, các sản phẩm chọn vào có thể dính nhiều mức VAT khác nhau (10%, 8%, 5%, 0%), dẫn đến khi kế toán xuất hóa đơn không xuất được hóa đơn gộp cho đơn hàng.

### Nguyên nhân gốc rễ
1. `CreateSODrawer.tsx`, `EditSODrawer.tsx`, `QuotationClient.tsx` cho phép chọn mức VAT độc lập trên từng dòng mà không kiểm soát sự đồng nhất.
2. `createSalesOrder`, `updateSalesOrder`, `createQuotation`, `updateQuotation` chưa validate kiểm tra danh sách mức VAT của các dòng.

### Cách fix
1. Trên Client: Khi người dùng thay đổi mức VAT ở bất kỳ dòng nào, hệ thống tự động đồng bộ mức VAT đó cho **tất cả các dòng** trong đơn.
2. Khi chọn/thêm sản phẩm mới vào đơn, tự động kế thừa mức VAT hiện tại của đơn hàng.
3. Trước khi submit & Server-side Action: Kiểm tra `distinctVatRates.length === 1`. Nếu đơn hàng có nhiều hơn 1 mức VAT, hệ thống sẽ chặn và thông báo lỗi rõ ràng.

### Bài học

> ⚠️ **RULE 54: Đơn Bán Hàng (SO) và Báo Giá (QTN) BẮT BUỘC phải duy nhất 1 loại thuế suất VAT trên toàn bộ các dòng để phục vụ xuất hóa đơn điện tử GTGT hợp lệ.**

---

## BUG-033: Lỗi Trùng Mã Đơn Hàng (soNo Unique Constraint Failed) Khi Tạo Đơn Bán Hàng

**Ngày:** 2026-08-08
**Severity:** 🔴 Critical — Người dùng không thể tạo đơn bán hàng mới.

### Triệu chứng
- Khi bấm "Tạo Đơn" ở màn hình Đơn Bán Hàng (`/dashboard/sales`), hệ thống báo lỗi toast:
  `Lỗi: Invalid prisma.salesOrder.create() invocation... Unique constraint failed on the fields: ("soNo")`

### Nguyên nhân gốc rễ
1. Code cũ sinh mã đơn hàng bằng cách đếm số lượng đơn hàng hiện tại trong cơ sở dữ liệu `prisma.salesOrder.count() + 1` (cho ra ví dụ `SO-2608-0010`).
2. Nếu trong DB từng có đơn hàng bị xóa hoặc đánh số không liên tục, phép tính `count() + 1` sẽ cho ra một mã đơn trùng lặp với đơn đã tồn tại sẵn trong DB.
3. Vì cột `soNo` có thuộc tính `UNIQUE`, Prisma ném ra ngoại lệ `Unique constraint failed`.

### Cách fix
1. Tạo hàm `generateUniqueSoNo()` truy vấn mã đơn hàng mới nhất thực tế trong DB theo tiền tố tháng `SO-YYMM-`, lấy số thứ tự lớn nhất hiện tại + 1.
2. Bổ sung vòng lặp kiểm tra tính duy nhất tuyệt đối (`while (existing)`) trong DB trước khi cấp mã, đảm bảo 100% không bao giờ bị trùng lặp mã đơn.
3. Cập nhật ở cả 2 vị trí: Tạo đơn hàng mới (`createSalesOrder`) và Chuyển Báo Giá thành Đơn Hàng (`convertQuotationToSO`).

### Bài học

> ⚠️ **RULE 55: Tuyệt đối không bao giờ dùng `count() + 1` để sinh mã chứng từ UNIQUE (SO, PO, DO, INV). Phải luôn query mã lớn nhất thực tế (`findFirst` desc) + kiểm tra trùng lặp.**

---

## BUG-034: Lỗi Chữ Tàng Hình / Trắng Trên Nền Trắng Thẻ Xuất Kho (DO Cards)

**Ngày:** 2026-08-08
**Severity:** 🟡 High — Giao diện thẻ Xuất Kho (DO) trên WMS hiển thị khối trắng bị che mất chữ.

### Triệu chứng
- Khi truy cập tab **Xuất Kho (DO)** trên trang WMS (`/dashboard/warehouse`), các ô chứa thông tin sản phẩm bên trong thẻ đơn hàng biến thành khối màu trắng tinh, chữ bên trong tàng hình không đọc được.

### Nguyên nhân gốc rễ
1. Trang WMS chạy theo Light Theme (giao diện sáng nền `#FFFFFF`).
2. Thẻ DO cũ khai báo màu nền tối `#0F1D2B` và `#142433`. `globals.css` tự động ánh xạ các mã màu tối này thành nền sáng `--color-lys-surface` (`#FFFFFF`).
3. Tên sản phẩm bên trong ô dùng mã màu chữ `#C8D8E4` (màu xanh nhạt). Vì `#C8D8E4` chưa được ánh xạ trong `globals.css`, màu chữ vẫn giữ nguyên màu xanh nhạt trên nền trắng `#FFFFFF`, gây ra hiện tượng chữ tàng hình.

### Cách fix
1. Thiết kế lại toàn bộ thẻ DO trong `DeliveryOrderTab.tsx` theo chuẩn Light Theme: Thẻ nền `#FFFFFF`, ô sản phẩm nền `#F8FAFC`, chữ tên sản phẩm màu Slate Đậm `#0F172A` (rõ nét 100%), số lượng màu Amber `#D97706`.
2. Bổ sung ánh xạ màu `#C8D8E4` ➔ `var(--color-lys-ivory)` (`#0F172A`) trong `globals.css` để ngăn ngừa lỗi tương tự ở các component khác.

### Bài học

> ⚠️ **RULE 56: Khi thiết kế component trong theme chuyển đổi, tất cả các ô container và màu chữ bên trong BẮT BUỘC phải đi cặp màu tương phản chuẩn (Dark Slate `#0F172A` trên nền sáng `#F8FAFC`).**

---

## BUG-035: Lỗi Foreign Key Constraint (`products_appellationId_fkey`) Khi Tạo Mới Sản Phẩm

**Ngày:** 2026-08-08  
**Severity:** 🔴 Critical — Không thể tạo sản phẩm mới khi chọn Vùng/Appellation trên giao diện web.

### Triệu chứng
- Khi tạo sản phẩm mới từ Drawer "Thêm Sản Phẩm Mới" (`/dashboard/products`), toast báo lỗi:  
  `Lỗi: Invalid prisma.product.create() invocation: Foreign key constraint violated on the constraint: 'products_appellationId_fkey'`

### Nguyên nhân gốc rễ
1. Trong CSDL Prisma, `WineRegion` đại diện cho Vùng rượu (Bordeaux, Burgundy, Tuscany...), còn `Appellation` đại diện cho vùng chỉ dẫn địa lý (Pauillac AOC, Margaux AOC, Pomerol AOC...).
2. Bảng `products` có khóa ngoại `appellationId` trỏ trực tiếp đến bảng `appellations.id`.
3. Tuy nhiên, ở giao diện `ProductDrawer.tsx`, component lại gọi hàm `getRegions()` (`prisma.wineRegion.findMany`) để đổ dữ liệu vào ô chọn "Vùng / Appellation".
4. Khi người dùng chọn một vùng (ví dụ "Bordeaux"), form gửi `form.regionId` (ví dụ `region-bordeaux` — ID của `WineRegion`) dưới dạng `appellationId`.
5. PostgreSQL kiểm tra ràng buộc `products_appellationId_fkey` và từ chối vì `region-bordeaux` thuộc bảng `wine_regions`, không tồn tại trong bảng `appellations`.

### Cách fix
1. Cập nhật `getAppellations` trong `actions.ts` để include tên và quốc gia của `region` đi kèm (`region: { select: { country: true, name: true } }`).
2. Sửa `ProductDrawer.tsx` và `ProductsClient.tsx` chuyển từ dùng `getRegions()` sang `getAppellations()`.
3. Cập nhật thẻ `<Select>` ô chọn Vùng/Appellation hiển thị danh sách Appellation kèm tên Vùng (ví dụ: `Pauillac AOC (Bordeaux)`).
4. Thêm xử lý mã lỗi `P2003` trong Server Action `createProduct` / `updateProduct` để trả về thông báo lỗi thân thiện nếu truyền sai ID tham chiếu.

### Bài học

> ⚠️ **RULE 57: Phải luôn kiểm tra kỹ định nghĩa quan hệ Schema (FK constraint). Nếu khóa ngoại trỏ vào `Appellation`, ô select bắt buộc phải nạp danh sách `Appellation` (chứa FK `Appellation.id`), không được nhầm lẫn với bảng cha `WineRegion`.**

---

## BUG-036: SWR Cache Stale Trên Tờ Trình, Cột Mã Cha Khách Hàng & Lỗi Chữ Tàng Hình Pháp Nhân

**Ngày:** 2026-08-08  
**Severity:** 🟡 Medium — Trạng thái tờ trình không đổi sau khi trình duyệt, cột mã cha hiển thị nhầm số chi nhánh và thông tin pháp nhân bị chìm chữ.

### Triệu chứng
1. Khi nhấn nút "Trình" duyệt tờ trình trên trang `/dashboard/proposals`, giao diện không thay đổi trạng thái từ Draft sang Pending Approval, các thẻ Stat Cards không phản hồi.
2. Trên trang Khách hàng (`/dashboard/customers`), cột `MÃ CHA` của công ty mẹ hiển thị `(2)` gây hiểu nhầm là mã cha bị hỏng.
3. Trên trang Cài đặt (`/dashboard/settings` tab Pháp Nhân & Kho), các ô thông tin Địa chỉ, Điện thoại, Email, Ngân hàng bị ẩn trắng không nhìn thấy. Nút "Chỉnh sửa" không bật được modal.

### Nguyên nhân gốc rễ
1. **Tờ trình**: Các Server Action (`submitProposal`, `processProposalApproval`, `createProposal`...) chỉ gọi `revalidatePath('/dashboard/proposals')` mà quên xóa cache SWR `revalidateCache('proposals')`. Dữ liệu SWR trả về bản ghi cũ trong bộ nhớ đệm 30s. Stat cards dùng `initialStats` server prop tĩnh thay vì tính toán động từ state `proposals`.
2. **Khách hàng**: Cột `MÃ CHA` cũ tự động fallback hiển thị số chi nhánh `(childrenCount)` nếu không có `parentCode`.
3. **Pháp nhân**: Các nhãn giá trị dùng `text-white` bị chìm trắng trên nền sáng, và `<EditEntityDrawer>` chưa được bao hàm trong JSX chính.

### Cách fix
1. Thêm `revalidateCache('proposals')` vào tất cả Server Action tờ trình; chuyển Stat Cards sang dùng `useMemo` tính từ `proposals` client state.
2. Sửa cột `MÃ CHA` chỉ hiển thị mã cha thực tế `row.parentCode` hoặc `—`, đưa chỉ số chi nhánh về badge Công ty.
3. Thay `text-white` bằng `style={{ color: '#E8F1F2' }}` trực tiếp trên các trường thông tin Pháp nhân và gắn `<EditEntityDrawer>` vào JSX.

### Bài học

> ⚠️ **RULE 58: Mọi Server Action cập nhật DB phải gọi đồng thời `revalidateCache('<prefix>')` để xóa SWR in-memory cache, tránh trả về dữ liệu cũ cho client.**

---

## BUG-037: Diễn Giải / Ghi Chú Đơn Hàng Bị Ẩn Trên Chi Tiết & Trang In

**Ngày:** 2026-08-08  
**Severity:** 🟡 Medium — Ghi chú/diễn giải đơn hàng người dùng nhập không xuất hiện trên chi tiết đơn hàng, trang in SO, trang in DO và bị mất khi sửa đơn.

### Triệu chứng
1. Khi tạo đơn hàng có nhập "Diễn giải / Ghi chú đơn hàng" (`notes`), mở Drawer Chi tiết đơn hàng (`SODetailDrawer`) không thấy hiển thị dòng ghi chú này.
2. Khi bấm "In Đơn" (Sales Order print `/dashboard/sales/print`) hoặc xem "Print Preview" (trong Drawer Tạo đơn) hoặc in phiếu xuất kho (Delivery Order print `/dashboard/warehouse/print`), nội dung ghi chú không xuất hiện trên bản in.
3. Khi mở Drawer Chỉnh sửa đơn hàng (`EditSODrawer`), ô ghi chú cũ không nạp lên và khi lưu sẽ làm mất ghi chú cũ.

### Nguyên nhân gốc rễ
1. **Drawer Chi tiết & Trang in SO/DO**: Trường `notes` thuộc model `SalesOrder` đã lưu thành công trong DB, nhưng component UI `SODetailDrawer`, `SalesOrderPrintPage`, `DOPrintPage` và `CreateSODrawer` (Print Preview) chưa render JSX hiển thị `notes`.
2. **Actions Print**: `getDOPrintDetail` trong `actions-print.ts` thiếu trường `soNotes: so.notes`.
3. **Drawer Edit SO**: `EditSODrawer.tsx` thiếu state `notes`, thiếu ô `<textarea>` nhập liệu và chưa nạp `detail.notes` khi khởi tạo.

### Cách fix
1. Thêm block hiển thị `detail.notes` trong `SODetailDrawer` (`SalesClient.tsx`).
2. Thêm block hiển thị `order.notes` trên trang in đơn hàng (`sales/print/page.tsx`) và `Print Preview Modal` (`CreateSODrawer.tsx`).
3. Bổ sung `soNotes: so.notes` vào `actions-print.ts` và render `data.soNotes` trên trang in phiếu xuất kho (`warehouse/print/page.tsx`).
4. Thêm state `notes`, nạp dữ liệu ban đầu, bổ sung ô `<textarea>` và truyền `notes` trong `EditSODrawer.tsx`.

### Bài học

> ⚠️ **RULE 59: Mọi trường văn bản ghi chú / diễn giải (`notes`, `memo`, `description`) được nhập ở form khởi tạo PHẢI được thiết kế đồng bộ hiển thị trên: 1) Drawer chi tiết, 2) Trang in (Print Page & Preview), 3) Form chỉnh sửa.**

---

## BUG-038: Số Lượng Thẻ Trạng Thái (Tab Counts) Không Lọc Theo Bộ Lọc Ngày / Tìm Kiếm

**Ngày:** 2026-08-08  
**Severity:** 🟡 Medium — Số lượng badge trên các tab trạng thái (Tất cả, Chờ KT, Đã XN, Huỷ...) hiển thị cố định tổng toàn bộ hệ thống, không thay đổi khi chọn bộ lọc ngày hay từ khóa tìm kiếm.

### Triệu chứng
Khi chọn bộ lọc ngày (ví dụ: "Hôm nay" 08/08/2026), bảng danh sách hiển thị 5 đơn hàng của ngày hôm nay, nhưng thanh thẻ trạng thái vẫn giữ nguyên con số tổng toàn thời gian: `Tất cả (11)`, `Chờ KT (4)`, `Đã XN (5)`, `Huỷ (2)`.

### Nguyên nhân gốc rễ
1. Hàm `getSOStatusCounts()` trong `actions.ts` không nhận tham số bộ lọc (`filters`). Hàm chỉ đếm `groupBy({ by: ['status'] })` trên toàn bộ bảng `sales_orders` không có điều kiện `where` cho ngày tạo, từ khóa, kênh, pháp nhân hay sales rep.
2. Hàm `getSalesPageData` khi nạp dữ liệu trang không truyền `filters` vào `getSOStatusCounts()`. Khi `onlyRows` là `true` (khi reload bảng), hàm trả về `statusCounts: {}`.

### Cách fix
1. Cập nhật `getSOStatusCounts(filters)` nhận đầy đủ các tham số bộ lọc (`search`, `dateFrom`, `dateTo`, `salesRepId`, `channel`, `legalEntityId`, `warehouseId`, `paymentTerm`, `pendingAction`) và áp dụng vào câu lệnh `where` của Prisma `groupBy`.
2. Cập nhật `getSalesStats(filters)` để các thẻ thống kê tổng doanh thu/số đơn cũng áp dụng bộ lọc đang chọn.
3. Trong `getSalesPageData`, truyền `filters` vào `getSOStatusCounts(filters)` và `getSalesStats(filters)`, đồng thời nạp `statusCounts` ngay cả khi `onlyRows` là `true`.

### Bài học

> ⚠️ **RULE 60: Các hàm tính toán số lượng thẻ gom nhóm (`groupBy` status counts, aggregate stats) PHẢI luôn nhận và áp dụng bộ lọc hiện tại (`dateFrom`, `dateTo`, `search`, v.v...) ngoại trừ chính tiêu chí phân loại của thẻ đó.**

---

## BUG-039: Thẻ Xuất Kho DO Không Hiển Thị Tên Khách Hàng và Mã SKU / Tên Sản Phẩm

**Ngày:** 2026-08-08  
**Severity:** 🟡 Medium — Các thẻ đơn chờ xuất kho (DO Cards) trên giao diện `/dashboard/warehouse` bị trống tên khách hàng và trống tên/mã sản phẩm.

### Triệu chứng
Trên giao diện tab **Xuất Kho (DO)**, thẻ `SO-2608-0013`, `SO-2608-0012`... chỉ hiển thị số lượng `x6`, `x1` ở góc phải, còn dòng tiêu đề khách hàng và các khung thông tin sản phẩm bị trống chữ.

### Nguyên nhân gốc rễ
1. Hàm `getSOsForDelivery()` trong `actions.ts` và `actions-do.ts` khi truy vấn Prisma trả về cấu trúc đối tượng lồng nhau: `customer: { name }` và `product: { productName, skuCode }`.
2. Giao diện `DeliveryOrderTab.tsx` truy cập trực tiếp các thuộc tính phẳng `so.customerName`, `line.productName`, `line.skuCode`. Do backend trả về đối tượng lồng nhau mà không map thành thuộc tính phẳng, các thuộc tính này bị `undefined`.

### Cách fix
1. Trong `getSOsForDelivery()` (`actions.ts` & `actions-do.ts`), map dữ liệu Prisma trả về dạng phẳng: `customerName: so.customer?.name`, `productName: l.product?.productName`, `skuCode: l.product?.skuCode`.
2. Trong `DeliveryOrderTab.tsx`, cập nhật hiển thị đồng thời **Mã SKU** (font bold monospace) + **Tên sản phẩm** + **Tên khách hàng** cùng với các fallback bảo vệ.

### Bài học

> ⚠️ **RULE 61: Mọi hàm Server Action trả dữ liệu danh sách cho component React UI PHẢI chuẩn hóa (map) các thuộc tính lồng (`customer.name` -> `customerName`, `product.productName` -> `productName`, `product.skuCode` -> `skuCode`) khớp đúng với TypeScript interface định nghĩa ở Client.**

---

## BUG-040: Lỗi Chọn Mã Hàng Sản Phẩm Trong Drawer Chuyển Kho do Dropdown Clipping & Blur Race Condition

**Ngày:** 2026-08-08  
**Severity:** 🔴 High — Người dùng không thể chọn sản phẩm khi tìm kiếm SKU trên Drawer Chuyển Kho Nội Bộ.

### Triệu chứng
1. Khi bấm gõ tìm kiếm SKU trên Drawer Chuyển Kho Nội Bộ (`CreateTransferDrawer`), danh sách sản phẩm bị che/cắt khung (clipping) do container bảng có `overflow-hidden` / `overflow-y-auto`.
2. Khi bấm chọn sản phẩm trong danh sách xổ xuống, sự kiện `onBlur` của ô input kích hoạt trước khiến dropdown tự đóng lại mà chưa ghi nhận giá trị vừa chọn.

### Nguyên nhân gốc rễ
1. Dropdown popover sử dụng `position: absolute` bên trong thẻ chứa bảng có `overflow-hidden`.
2. Lắng nghe sự kiện click thông thường trên option bị race condition với sự kiện `onBlur` của input text.

### Cách fix
1. Đặt `onMouseDown={(e) => { e.preventDefault(); onChange(p.id); setIsOpen(false); }}` trên option item để ngăn `onBlur` race condition.
2. Thêm `overflow-visible` cho container bảng và đặt z-index `z-[300]` cho danh sách popover.

### Bài học

> ⚠️ **RULE 62: Với mọi Combobox / Autocomplete Select component dạng Popover nằm trong Modal / Drawer / Scroll Table: 1) Đặt `onMouseDown` kèm `preventDefault()` trên option để tránh race condition với `onBlur`, 2) Container chứa bảng PHẢI có `overflow-visible` hoặc popover dùng Portal / Fixed Positioning z-index cao.**

---

## BUG-041: Thiếu Mã Số Thuế VAT & Tên Công Ty Xuất Hóa Đơn Chi Nhánh Con Khi Xuất Excel HĐĐT

**Ngày:** 2026-08-08  
**Severity:** 🟡 Medium — File Excel xuất báo cáo đơn bán hàng phục vụ upload Hóa đơn điện tử (MISA, VNPT, Viettel S-Invoice) bị trống Mã số thuế và Tên công ty đối với các đơn hàng lên cho chi nhánh con (nhà hàng).

### Triệu chứng
Đơn hàng lên cho nhà hàng chi nhánh con (vd: `HR10114-01` Mediterraneo Italian Restaurant) khi xuất Excel bị trống MST và Tên công ty VAT, dù công ty mẹ (`HR10114` Mediterraneo) đã có MST `0110538425` và tên công ty đăng ký thuế.

### Nguyên nhân gốc rễ
1. Các nhà hàng / chi nhánh con không lưu MST riêng mà sử dụng chung Mã số thuế của Công ty Mẹ / Công ty Chủ quản.
2. Hàm `exportSalesOrdersExcel` chỉ kiểm tra thuộc tính trực tiếp `o.customer.taxId` và `o.customer.vatCompanyName` mà chưa query thuộc tính của `o.customer.parent`.

### Cách fix
1. Cập nhật `exportSalesOrdersExcel` query thêm `parent: { select: { taxId, vatCompanyName, vatAddress, vatEmail } }`.
2. Áp dụng logic fallback: `taxId = o.customer.taxId || o.customer.parent?.taxId || ''`, `vatCompanyName = o.customer.vatCompanyName || o.customer.parent?.vatCompanyName || o.customer.name`.
3. Tích hợp API tự động tra cứu Tổng cục Thuế GDT (`api.vietqr.io/v2/business/`) và đồng bộ dữ liệu MST công ty mẹ xuống chi nhánh con.

### Bài học

> ⚠️ **RULE 63: Mọi câu truy vấn dữ liệu Hóa đơn VAT / Báo cáo Xuất HĐĐT cho Khách hàng PHẢI có cơ chế fallback tự động kế thừa Mã số thuế (`taxId`), Tên công ty (`vatCompanyName`), và Địa chỉ thuế (`vatAddress`) từ Công Ty Mẹ (`parent`) nếu Chi nhánh con chưa nhập riêng.**

---

## BUG-042: Thủ Kho Nhìn Thấy Nút Xuất Hóa Đơn & Nút Tạo Đơn Hàng Do Thiếu Kiểm Tra RBAC Trên UI & Server Action

**Ngày:** 2026-08-08  
**Severity:** 🔴 High — Vi phạm phân quyền RBAC: Nút `+ Xuất Hóa Đơn` và `+ Tạo Đơn Mới` hiển thị cho người dùng role `Thủ Kho` trong khi Thủ Kho không có quyền Hóa đơn VAT (`TAX:CREATE`) hay Tạo đơn hàng (`SLS:CREATE`).

### Triệu chứng
1. Khi đăng nhập vai trò `Thủ Kho` mở chi tiết Đơn bán hàng, giao diện vẫn hiển thị nút `+ Xuất Hóa Đơn` và nút `Bấm vào đây để Xuất / Gắn Hóa Đơn VAT`.
2. Hàm `createARInvoiceForSO` chỉ gọi `requireAuth()`, chưa gọi `requirePermission('TAX', 'CREATE')` để kiểm tra phân quyền tài chính/hóa đơn.
3. Nút `+ Tạo Đơn Mới` trên thanh công cụ `SalesClient.tsx` chưa được ẩn đối với role `Thủ Kho`.

### Nguyên nhân gốc rễ
1. Trạng thái hiển thị nút bấm trên Client Component chưa được truyền và kiểm tra mảng quyền `userPermissions` / `userRoles`.
2. Server Actions `createARInvoiceForSO` và `generatePOSVATInvoice` thiếu lớp bảo vệ `requirePermission` hoặc check vai trò người dùng trước khi thao tác DB.

### Cách fix
1. **Server Guard**: Thêm kiểm tra quyền `TAX:CREATE`, `TAX:WRITE`, `FIN:WRITE`, `KE_TOAN`, `ACCOUNTANT`, `CEO`, `SYS:ADMIN` vào `createARInvoiceForSO` (`sales/actions.ts`) and `generatePOSVATInvoice` (`pos/actions.ts`). Nếu không có quyền, Server Action lập tức chặn và trả lỗi.
2. **Client UI Guard**: Truyền `userPermissions` từ `sales/page.tsx` xuống `SalesClient.tsx`.
3. Khởi tạo `canCreateInvoice` và `canCreateSO` trong `SalesClient.tsx` và bọc toàn bộ nút `+ Xuất Hóa Đơn`, `+ Tạo Đơn Mới` bằng điều kiện kiểm tra quyền.

### Bài học

> ⚠️ **RULE 64: Mọi nút bấm tác động đến Dữ liệu / Tài chính / Hóa đơn (vd: Xuất Hóa Đơn, Tạo Đơn, Duyệt Đơn, Duyệt Kế Toán) PHẢI được bảo vệ bằng điều kiện phân quyền RBAC ở CẢ HAI LỚP: 1) Client UI (ẩn nút bấm nếu `!canPerformAction`), 2) Server Action (gọi `requirePermission` hoặc check role từ Session trước khi ghi DB).**

---

## BUG-043: Kế Toán & Trưởng Phòng Không Hiển Thị Nút Duyệt Tờ Trình Cơ Chế Giá Do Hardcode Điều Kiện isCEO

**Ngày:** 2026-08-08  
**Severity:** 🟡 Medium — Tài khoản Kế toán và Trưởng phòng kinh doanh vào trang Tờ trình Cơ chế giá không thấy nút Duyệt dù đã tới lượt duyệt của họ.

### Triệu chứng
1. Đăng nhập tài khoản vai trò Kế toán (`KE_TOAN`) hoặc Trưởng phòng (`SALES_MGR`), vào mục Duyệt Cơ Chế Giá (`/dashboard/proposals`).
2. Tờ trình ở trạng thái chờ duyệt (ví dụ: `currentLevel === 2` - lượt Kế toán duyệt) nhưng danh sách thẻ, bảng danh sách và Drawer chi tiết đều không hiển thị nút Duyệt / Từ chối / Trả lại.

### Nguyên nhân gốc rễ
1. Trong `ProposalsClient.tsx`, điều kiện hiển thị nút Duyệt bị ràng buộc cứng: `{isPending && isCEOLevel && isCEO && (...)}`.
2. Hệ thống kiểm tra vai trò người dùng bằng thuộc tính `isCEO = userRoles.includes('CEO')` và `isCEOLevel = p.currentLevel === 3`, dẫn tới chỉ có CEO duyệt ở Cấp 3 mới thấy nút Duyệt, còn Cấp 1 (Trưởng phòng) và Cấp 2 (Kế toán) hoàn toàn bị ẩn nút.

### Cách fix
1. Xây dựng hàm trợ giúp `canApproveAtLevel(level, userRoles)` trong `ProposalsClient.tsx` kiểm tra linh hoạt theo từng cấp:
   - Level 1: `SALES_MGR`, `SALES_ADMIN`, `MANAGER`, `TP`, `TRUONG_PHONG`, `ADMIN`, `CEO`.
   - Level 2: `KE_TOAN`, `CHIEF_ACCOUNTANT`, `ACCOUNTANT`, `ACCOUNTING`, `KT`, `KE_TOAN_TRUONG`, `ADMIN`, `CEO`.
   - Level 3: `CEO`, `BOD`, `DIRECTOR`, `GIAM_DOC`, `ADMIN`.
2. Thay thế toàn bộ điều kiện `isPending && isCEOLevel && isCEO` bằng `canApproveThis = isPending && canApproveAtLevel(p.currentLevel, userRoles)` trên danh sách thẻ, bảng dữ liệu và Drawer chi tiết.

### Bài học

> ⚠️ **RULE 65: Đối với quy trình phê duyệt nhiều cấp (Multi-level Approval Workflow), điều kiện hiển thị nút Duyệt trên giao diện KHÔNG ĐƯỢC hardcode theo 1 role duy nhất (như CEO), mà PHẢI dựa theo bảng ánh xạ vai trò linh hoạt tương ứng với cấp duyệt hiện tại (`currentLevel`) của tài liệu.**

---

## BUG-044: Tài Khoản Kế Toán Không Xem Được Danh Sách Khách Hàng (Chưa có khách hàng nào) Do Lỗi Alias Role và Quyền MDM:READ

**Ngày:** 2026-08-08  
**Severity:** 🔴 High — Người dùng vai trò Kế toán (`ketoan@lyscellars.com` / `Dinh (Kế toán)`) truy cập trang Khách Hàng (`/dashboard/customers`) bị báo "Chưa có khách hàng nào" (0 khách hàng).

### Triệu chứng
1. Đăng nhập tài khoản `Dinh (Kế toán)` vào trang Danh sách Khách Hàng (`/dashboard/customers`).
2. Màn hình chỉ hiển thị: "B2B: Khách sạn, nhà hàng, phân phối, VIP retail — 0 khách hàng", Tổng KH: 0, "Chưa có khách hàng nào".

### Nguyên nhân gốc rễ
1. Hàm `hasRole(user, 'Kế Toán', 'KE_TOAN')` chỉ kiểm tra đúng chính xác 2 chuỗi tên role đó. Nếu trong Database vai trò của user được lưu dưới các biến thể tên gọi như `ACCOUNTANT`, `ACCOUNTING`, `CHIEF_ACCOUNTANT`, `KE_TOAN_TRUONG`, `Kế toán`, hệ thống sẽ coi user đó KHÔNG PHẢI Kế toán.
2. Khi `!hasRole(user, ..., 'Kế Toán', 'KE_TOAN')` trả về `true` và user có role `Sales Rep` hoặc mặc định, hệ thống tự ép điều kiện `where.salesRepId = user.id`. Vì Kế toán không phụ trách trực tiếp làm Sale Rep cho khách hàng nào, truy vấn trả về 0 kết quả.
3. Nếu role của Kế toán trong DB chưa có quyền `MDM:READ`, `requirePermission('MDM', 'READ')` ném ngoại lệ làm cho `getCustomers()` thất bại và `page.tsx` bắt lỗi trả về danh sách rỗng (`rows: []`).

### Cách fix
1. Trong `src/lib/session.ts`, bổ sung bảng ánh xạ đồng bộ vai trò `ROLE_ALIASES`:
   - `KE_TOAN` / `Kế Toán` tự động ánh xạ bao gồm tất cả các alias: `['KE_TOAN', 'Kế Toán', 'Kế toán', 'ACCOUNTANT', 'ACCOUNTING', 'CHIEF_ACCOUNTANT', 'KE_TOAN_TRUONG', 'Kế toán trưởng']`.
2. Cập nhật `hasRole` tự động mở rộng (expand) danh sách vai trò cần kiểm tra thông qua `ROLE_ALIASES`.
3. Cập nhật `hasPermission`: Tự động cấp quyền `READ` cho tài khoản Kế toán (`Kế Toán`, `KE_TOAN`) đối với các module dữ liệu danh mục & tài chính (`MDM`, `FIN`, `TAX`, `SLS`, `PRC`, `CNT`, `CST`, `RPT`, `STM`, `DSH`, `WMS`, `TRS`).

### Bài học

> ⚠️ **RULE 66: Hàm `hasRole` và `hasPermission` PHẢI sử dụng cơ chế Bảng Ánh Xạ Đồng Bộ Alias (`ROLE_ALIASES`) và mặc định cho phép Kế toán (`KE_TOAN`) truy cập READ các module Danh mục (`MDM`), Đơn hàng (`SLS`), Tài chính (`FIN`), Hóa đơn (`TAX`) để tránh tình trạng lọc nhầm `salesRepId` hoặc ném ngoại lệ thiếu quyền khi người dùng đăng nhập bằng các vai trò kế toán khác nhau.**

---

## BUG-045: Tờ Trình Giá (`PRICE_ADJUSTMENT`) Đã Phê Duyệt Nhưng Không Tự Động Đẩy Dữ Liệu Vào Bảng Giá Khách Hàng (`CustomerPriceRule`)

**Ngày:** 2026-08-09  
**Severity:** 🟠 Medium — Tờ trình cơ chế giá (như TT-2026-006) đã duyệt/hoàn tất nhưng dữ liệu giá không được tự động đồng bộ sang bảng quy tắc giá khách hàng (`CustomerPriceRule`).

### Triệu chứng
1. Tờ trình `TT-2026-006` (Đề xuất cơ chế giá cho khách hàng Villa Des Fleurs) chuyển trạng thái `CLOSED` / `APPROVED`.
2. Kiểm tra Bảng giá khách hàng (`/dashboard/price-list`, tab Customer Rules) cho Villa Des Fleurs vẫn trống (`0 rules`), làm cho báo giá và đơn hàng không áp dụng được giá ưu đãi đã duyệt.

### Nguyên nhân gốc rễ
Hàm phê duyệt tờ trình `processProposalApproval` và cập nhật trạng thái `updateProposalStatus` trong `src/app/dashboard/proposals/actions.ts` chỉ thay đổi trạng thái của bản ghi `Proposal` (`status = 'APPROVED'` / `'CLOSED'`) mà không có logic tự động ghi/cập nhật danh mục mặt hàng từ `ProposalPriceItem` và % chiết khấu `discountPct` sang bảng `CustomerPriceRule`.

### Cách fix
1. Tạo script `scripts/sync-tt-2026-006.ts` thực thi đồng bộ ngay 135 quy tắc giá (`SPECIAL_PRICE` và `FIXED_DISCOUNT`) cho khách hàng Villa Des Fleurs từ tờ trình `TT-2026-006`.
2. Xây dựng hàm `syncProposalToCustomerPriceRules(proposalId)` trong `src/app/dashboard/proposals/actions.ts` tự động trích xuất `priceItems` và `discountPct` từ Tờ Trình để tạo/cập nhật `CustomerPriceRule`.
3. Tích hợp gọi `syncProposalToCustomerPriceRules` trong `processProposalApproval` (khi `newStatus === 'APPROVED'`) và `updateProposalStatus` (khi `status === 'CLOSED'`).

### Bài học

> ⚠️ **RULE 67: Mọi luồng phê duyệt Tờ trình Đề xuất Giá (`PRICE_ADJUSTMENT` / `PRICE_POLICY`) khi được duyệt hoàn tất (chuyển sang `APPROVED` hoặc `CLOSED`) PHẢI tự động kích hoạt hàm đồng bộ `syncProposalToCustomerPriceRules` để chuyển hóa danh mục giá/chiết khấu đề xuất sang bảng Quy tắc Giá Khách hàng (`CustomerPriceRule`), đảm bảo giá ưu đãi có hiệu lực ngay lập tức khi tạo Đơn hàng/Báo giá.**

---

## BUG-046: Lỗi Lưu Tờ Trình Mới — Trùng Mã `proposalNo` (`Unique constraint failed on the fields: ('proposalNo')`)

**Ngày:** 2026-08-09  
**Severity:** 🔴 High — Người dùng bấm "Lưu Bản Nháp" hoặc "Tạo Tờ Trình" bị báo lỗi từ chối lưu do trùng mã `proposalNo`.

### Triệu chứng
Khi tạo tờ trình mới, hệ thống hiển thị thông báo lỗi browser alert:
`Invalid prisma.proposal.create() invocation: Unique constraint failed on the fields: ('proposalNo')`

### Nguyên nhân gốc rễ
1. Hàm `generateProposalNo()` sử dụng truy vấn `findFirst({ where: { proposalNo: { startsWith: 'TT-2026-' } }, orderBy: { proposalNo: 'desc' } })`.
2. Do việc sắp xếp chuỗi trong PostgreSQL (alphabetical order), mã tờ trình tùy chỉnh dạng chuỗi chữ như `TT-2026-LUKLAK-5PCT` bị xếp đứng trên các mã số chuẩn `TT-2026-006` (chữ 'L' > '0' theo thứ tự ASCII).
3. Hàm lấy phần tử cuối cùng `proposalNo.split('-').pop()` thu được chuỗi `'5PCT'`.
4. `parseInt('5PCT', 10)` trong JavaScript bóc tách phần số đứng đầu ra `5` -> `seq = 5 + 1 = 6` -> sinh ra mã `TT-2026-006`.
5. Mã `TT-2026-006` đã tồn tại sẵn trong Cơ sở dữ liệu, dẫn tới câu lệnh `prisma.proposal.create()` bị lỗi vi phạm ràng buộc duy nhất (`Unique constraint failed`).

### Cách fix
1. Trong `src/app/dashboard/proposals/actions.ts`, sửa lại hàm `generateProposalNo()`:
   - Truy vấn danh sách mã tờ trình trong năm.
   - Dùng Regex `^TT-YYYY-(\d+)$` bóc tách và lọc chính xác các mã có phần đuôi là số thứ tự thuần túy để xác định `maxSeq` thực tế.
   - Thêm vòng lặp kiểm tra va chạm `while (await prisma.proposal.findUnique({ where: { proposalNo } }))` để đảo bảo không bao giờ sinh ra mã đã tồn tại.

### Bài học

> ⚠️ **RULE 68: Hàm tự động sinh mã số chứng từ (`generateCode` / `generateProposalNo`) KHÔNG ĐƯỢC dùng `findFirst` sắp xếp chuỗi `orderBy: { code: 'desc' }` để cắt số cuối, vì các mã chứa hậu tố chữ (custom slug) sẽ làm sai lệch thứ tự alphabet và hàm `parseInt` sẽ sinh trùng mã cũ. PHẢI dùng Regex lọc các mã số chuẩn và thêm bước kiểm tra chống trùng lặp (`findUnique`).**

---

## BUG-039: Stock Count Printable Audit Report Hardcoded Company Name & DRAFT Editing

**Ngày:** 2026-08-09  
**Severity:** 🟡 Medium — Biên bản kiểm kê A4 hiển thị cứng tên công ty cũ thay vì tên Pháp Nhân của Kho, và phiếu Nháp vẫn cho phép nhập đếm.

### Triệu chứng
1. Mẫu in Biên bản kiểm kê A4 hiển thị cứng tên "CÔNG TY TNHH LY CELLARS" cho tất cả các kho, không lấy theo Pháp Nhân đã gán cho Kho đó trong cài đặt.
2. Phiếu kiểm kê ở trạng thái Nháp (`DRAFT`) vẫn nhận số lượng nhập đếm.

### Nguyên nhân gốc rễ
1. Hàm `getStockCountDetail()` trong `actions.ts` chưa include relation `warehouse.legalEntity`.
2. Hàm `recordCountLine` và `recordMobileCountLine` chưa đặt chốt chặn kiểm tra `session.status === 'DRAFT'`.

### Cách fix
1. Thêm `legalEntity` vào query select `warehouse` trong `getStockCountDetail()` và truyền `legalEntityName`, `legalEntityTaxId`, `legalEntityAddress` ra `PrintableAuditReport.tsx`.
2. Thêm validation chặn lưu khi `session.status === 'DRAFT'` hoặc `APPROVED`/`CANCELLED`.

### Bài học

> ⚠️ **RULE 69: Mẫu in chứng từ hành chính A4 (Phiếu kiểm kê, Phiếu xuất kho, Hóa đơn) BẮT BỤC phải lấy tên Đơn vị / Pháp nhân (`legalEntity`) động từ cài đặt Kho / Chi nhánh tương ứng, không được ghi nhận giá trị cứng (hardcoded string) trong giao diện.**

---

## BUG-040: WMS Delivery Order Default Warehouse Resolved Wrong Legal Entity

**Ngày:** 2026-08-09  
**Severity:** 🔴 High — Nguy cơ xuất nhầm hàng từ kho của Pháp nhân khác (VD: Đơn hàng thuộc Thắng Ân nhưng hệ thống tự động chọn Kho Showroom Lys).

### Triệu chứng
Khi mở drawer **Nhặt Hàng & Tạo DO** cho một Đơn Bán Hàng (`SO-2608-0021` thuộc Pháp nhân Thắng Ân - TA), mục **Kho Xuất Bán (Tự Động Mặc Định)** tự động nạp **Kho Showroom (Lys)** (thuộc Pháp nhân Ly's Cellar - LC) thay vì Kho Thắng Ân (GVM).

### Nguyên nhân gốc rễ
1. Type interface của mảng `warehouses` trong `DeliveryOrderTab.tsx` và `CreateDODrawer` ban đầu bị đứt gãy kiểu dữ liệu (thiếu `legalEntityId`, `legalEntityCode`).
2. Bên trong `CreateDODrawer` tồn tại một hàm trùng tên `resolveWarehouseForSO()` nội bộ (inner closure override), hàm này sử dụng logic lọc cũ và ghi đè lên hàm xuất chung.
3. Component `CreateDODrawer` nhận prop `warehouses` tĩnh từ cha mà không tự động fetch lại danh sách kho mới nhất từ Server Action `getWarehouses()`, đồng thời dropdown `renderWarehouseSelect()` thiếu logic lọc đa tầng Pháp Nhân.

### Cách fix
1. Thêm `legalEntity: { select: { code: true, name: true } }` vào cả 2 query `getSOsForDelivery()` và `getWarehouses()`.
2. Loại bỏ hàm trùng tên nội bộ bên trong `CreateDODrawer`, bắt buộc 100% giao diện dùng chung hàm `resolveWarehouseForSO(targetSO, warehouses)`.
3. Trong `CreateDODrawer`, khởi tạo state `currentWhs` và tự động gọi `getWarehouses()` trong `useEffect` khi mở modal để đảm bảo danh sách kho luôn tươi mới 100% từ Database.
4. Cập nhật `renderWarehouseSelect()` áp dụng bộ lọc đa tầng Pháp Nhân (ID $\rightarrow$ Code $\rightarrow$ Name) cho danh sách kho xuất bán.

### Bài học

> ⚠️ **RULE 70: Khi viết các helper function xử lý logic khớp nối (như `resolveWarehouseForSO`), BẮT BỤC phải khai báo exported function ở cấp module và KHÔNG ĐƯỢC khai báo hàm trùng tên bên trong Component con (`CreateDODrawer`). Các Modal/Drawer độc lập BẮT BỤC phải có cơ chế tự động re-fetch danh sách danh mục (Kho, Pháp Nhân) để đảm bảo không bị dính dữ liệu đứt gãy từ prop cha.**

---

## BUG-041: Internal Stock Transfers (TransferOrder) Missing from NXT Summary & Movement Reports

**Ngày:** 2026-08-13  
**Severity:** 🔴 High — Sai lệch báo cáo Nhập Xuất Tồn kho khi có giao dịch Điều Chuyển Nội Bộ.

### Triệu chứng
Phiếu Chuyển Kho `TO-2608-0001` ở trạng thái **Đã Nhận Hàng (`RECEIVED`)** (chuyển 120 chai từ Kho Thường Tín về Kho Thắng Ân), tuy nhiên khi kiểm tra **Báo Cáo Nhập Xuất Tồn Kho** (Tab Báo Cáo NXT Kho & Sổ Chi Tiết Giao Dịch Kho), không ghi nhận bất kỳ giao dịch Nhập/Xuất nào cho phiếu chuyển này.

### Nguyên nhân gốc rễ
1. Trong `src/app/dashboard/warehouse/actions-nxt.ts`, hàm `getWarehouseNXTReport()` chỉ tổng hợp số lượng Nhập từ `GoodsReceiptLine` (Phiếu Nhập Mua PO) và số lượng Xuất từ `DeliveryOrderLine` (Phiếu Xuất Bán SO).
2. Tương tự, hàm `getStockMovements()` chỉ query dòng Nhập `GoodsReceiptLine` (`docType: 'GR'`) và dòng Xuất `DeliveryOrderLine` (`docType: 'DO'`).
3. Dữ liệu từ bảng `TransferOrderLine` (`TRANSFER_IN` và `TRANSFER_OUT`) hoàn toàn bị bỏ qua trong cả 4 chỉ số: Tồn Đầu Kỳ, Nhập Trong Kỳ, Xuất Trong Kỳ và Sổ Chi Tiết Thẻ Kho.

### Cách fix
1. Trong `getWarehouseNXTReport()`, bổ sung aggregate `prisma.transferOrderLine.groupBy()` cho cả:
   - **Nhập điều chuyển đầu kỳ & trong kỳ (`TRANSFER_IN`)**: Nhóm các phiếu có `status: 'RECEIVED'` theo `toWarehouseId`.
   - **Xuất điều chuyển đầu kỳ & trong kỳ (`TRANSFER_OUT`)**: Nhóm các phiếu có `status: { in: ['IN_TRANSIT', 'RECEIVED'] }` theo `fromWarehouseId`.
2. Tính toán tổng `opIn`, `opOut`, `inQty`, `outQty` bao gồm cả giao dịch điều chuyển kho.
3. Trong `getStockMovements()`, bổ sung query lấy danh sách dòng điều chuyển `TRANSFER_IN` và `TRANSFER_OUT` để đưa vào Sổ Chi Tiết Thẻ Kho (Ledger), sắp xếp theo mốc thời gian và tính tồn lũy kế running balance chính xác.

### Bài học

> ⚠️ **RULE 71: Khi xây dựng Báo cáo Nhập Xuất Tồn (NXT) hoặc Sổ Thẻ Kho (Stock Movement Ledger), BẮT BỤC phải tổng hợp đầy đủ TẤT CẢ các luồng nhập/xuất kho của hệ thống bao gồm: Nhập mua hàng (`GR`), Xuất bán hàng (`DO`), Nhập/Xuất điều chuyển nội bộ (`TRANSFER_IN` / `TRANSFER_OUT`), và Điều chỉnh kiểm kê (`ADJ`). Không được chỉ query duy nhất PO/SO.**

---

## BUG-042: GDT Tax E-Invoice Integration Returning HTTP 500 "Search params {null} is invalid"

**Ngày:** 2026-08-13  
**Severity:** 🔴 High — Đăng nhập Cổng Thuế (`hoadondientu.gdt.gov.vn`) thành công nhưng không kéo được danh sách Hóa Đơn Điện Tử.

### Triệu chứng
Khi người dùng nhập mã Captcha và ấn **"Đăng Nhập & Đồng Bộ Hóa Đơn"** tại màn hình Tra Cứu Thuế (`/dashboard/tax`), giao diện trả về thông báo lỗi:
`❌ Đăng nhập thành công nhưng không thể tải danh sách hóa đơn từ Cổng Thuế (Mã lỗi HTTP 500: Search params {null} is invalid).`

### Nguyên nhân gốc rễ
1. Backend Cổng Thuế Thuế Việt Nam (`hoadondientu.gdt.gov.vn`) sử dụng FIQL (Feed Item Query Language) / RSQL parser để xử lý tham số tìm kiếm `search` trong URL query string.
2. Trong `src/app/dashboard/tax/actions.ts`, hàm `fetchGdtInvoicesAction` trước đây gửi request GET không có tham số `search` (`?sort=tdlap:desc&size=50&page=0`) hoặc gửi body POST không đúng chuẩn GET API của GDT.
3. Khi Spring Boot backend của Cổng Thuế nhận request thiếu tham số `search` hoặc `search` không đúng cú pháp FIQL, controller truyền giá trị `null` vào parser dẫn tới văng lỗi `Search params {null} is invalid` và trả về HTTP 500.

### Cách fix
1. Cập nhật `fetchGdtInvoicesAction` trong `src/app/dashboard/tax/actions.ts` truyền đúng cú pháp FIQL search parameter mà Cổng Thuế yêu cầu:
   - Candidate 1: `sort=tdlap:desc&size=${size}&page=${page}&search=tdlap=ge=${startOfYearStr}T00:00:00;tdlap=le=${todayStr}T23:59:59`
   - Candidate 2: `sort=tdlap:desc&size=${size}&page=${page}&search=tdlap=ge=${startOfYearStr};tdlap=le=${todayStr}`
   - Candidate 3: `sort=tdlap:desc&size=${size}&page=${page}&search=tdlap=ge=${startOfYearStr}T00:00:00`
2. Duyệt tuần tự danh sách các cú pháp FIQL hợp lệ cho tới khi nhận kết quả `HTTP 200 OK` từ Cổng Thuế.

### Bài học

> ⚠️ **RULE 72: Khi tích hợp API với Cổng Hóa Đơn Điện Tử Thuế (`hoadondientu.gdt.gov.vn`), tham số `search` trên endpoint `/api/query/invoices/sold` và `/api/query/invoices/purchase` BẮT BỤC phải tuân theo chuẩn FIQL format (ví dụ: `search=tdlap=ge=01/01/2026T00:00:00;tdlap=le=13/08/2026T23:59:59`). Bỏ trống hoặc gửi sai định dạng `search` sẽ khiến Cổng Thuế trả lỗi HTTP 500 "Search params {null} is invalid".**

---

## BUG-045: Báo Cáo Nhập Xuất Tồn Sai Tồn Đầu Kỳ & Sai Số Liệu Luân Chuyển Khi Lọc Tất Cả Kho

**Ngày:** 2026-08-13  
**Severity:** 🔴 High — Tồn đầu kỳ bị tính bằng 0 làm tồn cuối kỳ âm (ví dụ: -2 chai), luân chuyển kho nội bộ bị cộng dồn thổi phồng nhập/xuất toàn công ty, không đồng bộ với dropdown chọn kho ở thanh Header.

### Triệu chứng
1. Khi tra cứu Báo Cáo Nhập Xuất Tồn Kho (`/dashboard/warehouse` -> Tab Báo Cáo Nhập Xuất Tồn), số lượng Tồn Đầu Kỳ hiển thị `0 chai` đối với các sản phẩm có lô hàng khởi tạo/nhập trực tiếp (`StockLot`), dẫn tới Tồn Cuối Kỳ bị âm dù tồn thực tế trong kho > 270 chai.
2. Khi lọc **"Tất cả các kho"**, các phiếu điều chuyển nội bộ giữa 2 kho trong cùng công ty (ví dụ: Kho Thường Tín -> Kho Thắng Ân) bị cộng đồng thời vào cả **Tổng Nhập (+24)** và **Tổng Xuất (-24)** toàn công ty, thổi phồng tổng kim ngạch nhập/xuất dù tổng kho công ty không đổi.
3. Khi đổi kho ở dropdown thanh Header trên cùng (`WarehouseClient`), tab Báo Cáo Nhập Xuất Tồn không nhận được `selectedWarehouseId` nên vẫn hiển thị số liệu `"Tất cả các kho"`.
4. Bảng *"Phân bổ tồn kho thực tế theo vị trí"* ở panel bên phải không lọc vị trí kệ theo `warehouseId` được chọn.

### Nguyên nhân gốc rễ
1. Trong `src/app/dashboard/warehouse/actions-nxt.ts`, hàm `getWarehouseNXTReport()` và `getStockMovements()` trước đây chỉ aggregate số nhập từ `GoodsReceiptLine` (bảng phiếu nhập PO). Tuy nhiên, 550 lô hàng trong DB được khởi tạo/nhập trực tiếp dạng `StockLot` (không có dòng `GoodsReceiptLine`), khiến số tồn đầu kỳ và nhập trong kỳ bị tính bằng `0`.
2. Khi `warehouseId` không được truyền (`Tất cả các kho`), truy vấn `transferOrderLine` tự động match tất cả các phiếu chuyển nội bộ và cộng dồn vào cả `inQty` lẫn `outQty`.
3. Trong `WarehouseClient.tsx`, `<StockMovementTab />` không được truyền prop `selectedWarehouseId={selectedWH}`.
4. Trong `actions-nxt.ts`, hàm `getProductStockByLocation(productId)` thiếu tham số `warehouseId` nên luôn query tất cả vị trí thuộc mọi kho.

### Cách fix
1. Trong `actions-nxt.ts`:
   - Tính Tồn Đầu Kỳ và Nhập Trong Kỳ từ `StockLot` (`receivedDate < fromDate` và `gte fromDate lte toDate`, loại bỏ các lô chuyển kho `TRF-`).
   - Đưa điều kiện kiểm tra `warehouseId`: Chỉ cộng `TRANSFER_IN` / `TRANSFER_OUT` vào `inQty` / `outQty` khi người dùng lọc một kho cụ thể. Khi lọc **"Tất cả các kho"**, các giao dịch điều chuyển nội bộ không cộng vào tổng nhập/xuất của công ty.
   - Cập nhật `getProductStockByLocation(productId, warehouseId)` thêm lọc `location: { warehouseId }`.
2. Trong `StockMovementTab.tsx`:
   - Bổ sung prop `selectedWarehouseId?: string` và dùng `useEffect` để sync `warehouseId` filter state bất cứ khi nào người dùng chọn kho từ thanh Header.
   - Tự động re-query chi tiết thẻ kho và vị trí kệ kho tương ứng với `warehouseId`.
3. Trong `WarehouseClient.tsx`:
   - Truyền `selectedWarehouseId={selectedWH ?? undefined}` vào `<StockMovementTab />`.

### Bài học

> ⚠️ **RULE 73: Khi tính Báo cáo Nhập Xuất Tồn (NXT), BẮT BỤC phải tính nguồn nhập từ `StockLot` (lô hàng nhập/khởi tạo) song song với `GoodsReceiptLine`. Khi ở chế độ xem "Tất cả các kho" (All Warehouses), chuyển kho nội bộ (`TRANSFER_IN`/`TRANSFER_OUT`) là giao dịch nội bộ công ty (net effect = 0), KHÔNG ĐƯỢC cộng dồn làm tăng Tổng Nhập và Tổng Xuất của toàn doanh nghiệp.**

---

## BUG-046: Mẫu In Biên Bản Kiểm Kê A4 Lỗi Font Tiếng Việt, Sai Trạng Thái Chênh Lệch và Thiếu Cột Vintage Độc Lập

**Ngày:** 2026-08-14  
**Severity:** 🟡 Medium — Văn bản in A4 kiểm kê bị lỗi tách dấu tiếng Việt trên Windows, hiển thị "Khớp" sai lệch khi chưa nhập số đếm, và gom chung Tên sản phẩm với Niên vụ.

### Triệu chứng
1. Khi in/xem Biên bản kiểm kê A4 (`PrintableAuditReport.tsx`), các từ tiếng Việt có dấu ghép (như `THẮNG ÂN`, `TẦNG`, `Số`, `Mã phiếu`, `THÀNH PHẦN`, `Kế toán kho`, `KẾT QUẢ`, `Tồn Sổ Sách`, `Kiểm Thực Tế`) bị lỗi tách dấu thành 2 ký tự riêng lẻ (VD: `THẮ´NG ÂN`, `Tồ`n Sổ Sách`, `Kiểm Thực Tế´`).
2. Các dòng kiểm kê chưa đếm hoặc chưa nhập số thực tế (`qtyActual: null`), cột Chênh Lệch vẫn hiển thị chữ "Khớp" dù tồn sổ sách đang có số lượng (1, 60, 36, 11...).
3. Tên sản phẩm và Niên vụ (Vintage) bị gộp chung vào 1 cột `Tên Sản Phẩm & Vintage`.

### Nguyên nhân gốc rễ
1. Class `font-serif` trong Tailwind CSS ưu tiên font `Georgia` trên Windows trước `Times New Roman`. Font `Georgia` trên Windows không hỗ trợ đầy đủ các ký tự Unicode tiếng Việt tổ hợp/dựng sẵn (precomposed Unicode), dẫn đến việc bộ kết xuất font tách rời nguyên âm và dấu thanh/dấu mũ.
2. Logic kiểm tra chênh lệch `{variance === null || variance === 0 ? 'Khớp' : ...}` coi `null` (chưa kiểm) giống với `0` (khớp).
3. Cột bảng gộp chung Tên & Vintage vào 1 cột thay vì tách riêng theo tiêu chuẩn biểu mẫu kế toán kho.

### Cách fix
1. Cấu hình font chữ chuẩn văn bản hành chính Việt Nam (`Times New Roman, Times, Liberation Serif, serif`) cho toàn bộ tài liệu in A4 và bảng biểu, khắc phục 100% hiện tượng lỗi tách dấu tiếng Việt.
2. Sửa logic: nếu `qtyActual === null` thì hiển thị dấu gạch ngang `-`, chỉ hiển thị `Khớp` khi `qtyActual !== null` và `variance === 0`, hiển thị `+${variance}` (khi thừa) hoặc `${variance}` (khi thiếu).
3. Tách cột `Vintage` (Niên vụ) thành cột riêng biệt độc lập (10 cột tổng thể), căn giữa và định dạng font rõ ràng; điều chỉnh `colSpan={6}` ở dòng tổng cộng cuối bảng.

### Bài học

> ⚠️ **RULE 74: Các mẫu in chứng từ chuẩn A4 (Biên bản kiểm kê, Hóa đơn, Phiếu xuất nhập kho) BẮT BỤC phải khai báo font chuẩn hành chính `"Times New Roman", Times, "Liberation Serif", serif` thay vì `font-serif` (để tránh lỗi Windows tự động fallback sang `Georgia` làm bể dấu tiếng Việt). Các chỉ số chênh lệch kiểm kê khi `qtyActual === null` (chưa đếm) BẮT BỤC phải hiển thị `-` (không được hiển thị `Khớp`).**









