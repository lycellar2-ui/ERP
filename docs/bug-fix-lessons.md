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

## Quick Reference — All Rules

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
