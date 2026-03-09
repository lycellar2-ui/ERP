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

