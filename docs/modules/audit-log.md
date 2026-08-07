# Audit Log (AUD) — Wine ERP Module Spec

> **Route:** `/dashboard/audit-log`
> **Mã module:** AUD
> **Thêm ngày:** 2026-08-07

---

## Mô Tả

Module Nhật ký thao tác (Audit Log) hiển thị toàn bộ lịch sử thay đổi dữ liệu trong hệ thống. Mọi hành động CREATE/UPDATE/DELETE trên các entity đều được ghi nhận tự động thông qua hàm `logAudit()` và `logAuditWithDiff()` từ `lib/audit.ts`.

## Tính Năng

### Dashboard Audit Log
- **Bảng dữ liệu** phân trang (30 rows/page) với cột: User, Action, Entity Type, Entity ID, Thời gian
- **Bộ lọc nâng cao**: Search text, Entity Type dropdown, Action type, User, Date range (from/to)
- **Diff Viewer**: Xem chi tiết `oldValue` vs `newValue` cho mỗi thay đổi (JSON diff)

### Statistics
- Tổng số audit logs, số log hôm nay, tuần này
- Số user unique đã thao tác
- Top actions (CREATE, UPDATE, DELETE) theo số lượng
- Top modules (entityType) theo tần suất thay đổi

## Files

| File | Vai trò |
|---|---|
| `actions.ts` | Server Actions: `getAuditLogsDashboard()`, `getAuditStats()`, `getAuditEntityTypes()`, `getAuditUsers()` |
| `AuditLogClient.tsx` | Client component 33KB — bảng, bộ lọc, diff viewer |
| `page.tsx` | Server page wrapper |
| `loading.tsx` | Skeleton loading |

## Domain Ownership

- **Bảng sở hữu:** `AuditLog` (READ-ONLY từ module này — dữ liệu được ghi bởi `lib/audit.ts` từ các module khác)
- **Không có mutation** — module này chỉ đọc và hiển thị

## Phụ thuộc
- `lib/audit.ts` — Shared library ghi audit log
- `lib/cache.ts` — Cache query results
