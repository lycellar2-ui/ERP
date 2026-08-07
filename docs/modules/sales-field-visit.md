# Sales Field Visit (SFV) — Wine ERP Module Spec

> **Route:** `/dashboard/sales/visits`
> **Mã module:** SFV
> **Thêm ngày:** 2026-08-07

---

## Mô Tả

Module Viếng thăm điểm bán (Sales Field Visit) cho phép nhân viên bán hàng check-in/check-out tại các điểm bán HORECA/đại lý, kèm theo chụp ảnh bắt buộc và GPS tracking. Dùng để quản lý hoạt động thực địa của sales team.

## Tính Năng

### Check-in Flow
1. **Chọn khách hàng** — Searchable Combobox (Admin có thể chọn salesperson khác)
2. **Chụp ảnh camera bắt buộc** — Live camera modal, OS native camera fallback
3. **GPS tự động** — 2-tier fallback (high accuracy → balanced), reverse geocoding via Nominatim API
4. **Ghi nhận mục đích** viếng thăm (tùy chọn)
5. Tạo mã visit: `VIS-YYYYMM-XXXX`

### Check-out Flow
1. **Chụp ảnh checkout bắt buộc** — chứng minh đã hoàn thành
2. **Ghi chú** — notes về cuộc viếng thăm
3. **GPS checkout** — xác nhận vị trí kết thúc
4. **Tính Duration** tự động (phút)

### Quản Lý
- Bảng lịch sử visits: columns Check-in/Check-out time, Duration, Customer, Address
- **Photo Viewer**: zoom, download, open in new tab
- **Mobile responsive** card view
- Admin xem tất cả, salesperson chỉ xem của mình

## Files

| File | Vai trò |
|---|---|
| `actions.ts` | `checkInSalesVisit()`, `checkOutSalesVisit()`, `getActiveVisit()`, `getSalesVisits()`, `getSalespersons()`, `getCustomersForVisit()` |
| `SalesVisitsClient.tsx` | Client component 58KB — check-in/out UI, GPS, camera |
| `LiveCameraModal.tsx` | Camera capture component 14KB — stream, capture, fallback |
| `page.tsx` | Server page wrapper |

## Prisma Models

- `SalesVisit` — Bảng chính: visitNo, customerId, salespersonId, checkInTime/checkOutTime, checkInPhoto/checkOutPhoto, GPS coords, status
- `SalesVisitSchedule` — Lịch viếng thăm định kỳ
- `WeeklyVisitPlan` — Kế hoạch tuần

## Enums
- `VisitStatus` — IN_PROGRESS, COMPLETED, CANCELLED
- `ScheduleFrequency` — DAILY, WEEKLY, BIWEEKLY, MONTHLY

## Domain Ownership

- **Bảng sở hữu:** `SalesVisit`, `SalesVisitSchedule`, `WeeklyVisitPlan`
- **Đọc từ:** `Customer`, `User` (salesperson)

## Constraints
- ❌ Không thể check-in nếu đang có visit IN_PROGRESS (phải check-out trước)
- ❌ Bắt buộc chụp ảnh khi check-in và check-out
- GPS coordinates là optional nhưng strongly recommended
