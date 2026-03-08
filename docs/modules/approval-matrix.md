# Ma Trận Phân Quyền Phê Duyệt (Approval Matrix) — APM
**Module:** `APM` (sub-module of `SYS`) | Người dùng: CEO, Admin | Ưu tiên: 🟢 P3

Trang cấu hình tập trung cho toàn bộ quy trình phê duyệt — proposal routing, SO/PO threshold, discount limits.

---

## 1. Tổng Quan

### 1.1 Vấn đề giải quyết
- Trước đây, luồng duyệt và ngưỡng phê duyệt **hardcoded** trong source code
- CEO/Admin **không thể tự điều chỉnh** mà không liên hệ developer
- Thiếu **nhìn tổng quan** về toàn bộ quy tắc phê duyệt đang áp dụng

### 1.2 Giải pháp
- **Trang cấu hình trực quan** với ma trận toggle ✓/✗
- **Lưu vào DB** (bảng `approval_configs`) — persist across deployments
- **3 section** rõ ràng: Routing + Thresholds + Summary

---

## 2. Truy Cập

| | |
|---|---|
| **Sidebar** | `Hệ Thống → Ma Trận Phân Quyền` |
| **URL** | `/dashboard/settings/approval-matrix` |
| **Icon** | Shield (lucide-react) |
| **Phân quyền** | CEO, Admin |

---

## 3. Cấu Trúc Giao Diện

### 3.1 Section 1: Luồng Phê Duyệt Tờ Trình

Ma trận interactive: **14 loại tờ trình** × **3 cấp duyệt**

| Cấp | Vai trò | Màu |
|-----|---------|-----|
| Cấp 1 | TP Bộ Phận | #4A8FAB (xanh dương) |
| Cấp 2 | KT Trưởng | #D4A853 (vàng) |
| Cấp 3 | CEO | #E05252 (đỏ) |

**Tương tác:**
- Click vào ô → Toggle bật/tắt cấp duyệt
- CEO (Cấp 3) **không thể tắt** — bắt buộc duyệt cuối
- Cột "Luồng Duyệt" cập nhật realtime (ví dụ: `TP → KT → CEO`)
- Nút "Lưu Thay Đổi" chỉ active khi có thay đổi

### 3.2 Section 2: Ngưỡng Phê Duyệt Tự Động

4 trường input có thể chỉnh sửa:

| Key | Label | Default | Đơn vị |
|-----|-------|---------|--------|
| `so.amount_threshold` | SO: Giá trị cần CEO duyệt | 100,000,000 | ₫ |
| `so.discount_threshold` | SO: % Chiết khấu cần duyệt | 15 | % |
| `po.amount_threshold` | PO: Giá trị cần CEO duyệt | 200,000,000 | ₫ |
| `proposal.amount_auto_ceo` | Tờ Trình: Giá trị lên CEO trực tiếp | 500,000,000 | ₫ |

**Logic hoạt động:**
- Khi tạo SO mới → `confirmSalesOrder()` kiểm tra `totalAmount >= threshold` → tự động chuyển `PENDING_APPROVAL`
- Khi discount > threshold → tự động cần CEO duyệt
- PO tương tự cho đơn mua hàng

### 3.3 Section 3: Tóm Tắt Quy Tắc Hiện Hành

3 thẻ tổng hợp:
1. **Đơn Bán Hàng (SO)**: Ngưỡng giá trị + % discount
2. **Đơn Mua Hàng (PO)**: Ngưỡng giá trị  
3. **Tờ Trình — Luồng CEO**: Số loại 3 cấp, 2 cấp, CEO trực tiếp

---

## 4. Database Schema

### `ApprovalConfig` (approval_configs)

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | cuid | Primary key |
| `configKey` | String @unique | Ví dụ: `proposal.BUDGET_REQUEST`, `so.amount_threshold` |
| `value` | Json | `{ levels: [1,2,3] }` hoặc `{ threshold: 100000000 }` |
| `label` | String? | Mô tả cho hiển thị |
| `updatedAt` | DateTime | Lần cập nhật cuối |
| `updatedBy` | String? | Người cập nhật |

**Thiết kế key-value JSON** cho flexibility — không cần migrate schema khi thêm loại config mới.

---

## 5. Server Actions

| Action | Mô tả |
|--------|-------|
| `getApprovalMatrix()` | Load full config từ DB, fallback default nếu chưa có |
| `saveProposalRoute(category, levels)` | Upsert routing cho 1 loại tờ trình |
| `saveThreshold(key, value)` | Upsert 1 ngưỡng |
| `saveAllRoutes(routes)` | Bulk upsert tất cả routing |
| `saveAllThresholds(thresholds)` | Bulk upsert tất cả ngưỡng |

---

## 6. Files

```
src/app/dashboard/settings/approval-matrix/
├── page.tsx                    # Server page (fetch data)
├── actions.ts                  # Server actions (CRUD)
└── ApprovalMatrixClient.tsx    # Client component (interactive matrix UI)

prisma/schema.prisma            # Model ApprovalConfig
src/components/layout/Sidebar.tsx # Sidebar link (Hệ Thống section)
```

---

## 7. Liên Kết Với Module Khác

| Module | Cách liên kết |
|--------|--------------|
| **PRO (Tờ Trình)** | `proposals/actions.ts` đọc `CATEGORY_ROUTING` → sử dụng khi submit + approve |
| **SLS (Sales)** | `sales/actions.ts` đọc `SO_APPROVAL_THRESHOLD` + `DISCOUNT_APPROVAL_THRESHOLD` |
| **PRC (Procurement)** | `procurement/ProcurementClient.tsx` StatusStepper đọc threshold khi advance PO |
| **DSH (Dashboard)** | Widget "Chờ CEO Duyệt" gộp PO + SO + Tờ Trình theo config |

---

## 8. Implementation Status ✅

| Tính năng | Trạng thái |
|-----------|-----------|
| Database model `ApprovalConfig` | ✅ |
| Server actions (5 functions) | ✅ |
| Interactive matrix UI (toggle grid) | ✅ |
| Threshold input fields | ✅ |
| Summary reference panel | ✅ |
| Sidebar navigation link | ✅ |
| Persist to DB (upsert) | ✅ |
| Fallback defaults | ✅ |

> **Note:** Hiện tại `SO_APPROVAL_THRESHOLD` trong `sales/actions.ts` vẫn dùng hardcoded constant. Kế hoạch tiếp theo sẽ kết nối trực tiếp với `ApprovalConfig` table để hoàn chỉnh dynamic config.

---

*Last updated: 2026-03-08 | Wine ERP v5.2*
