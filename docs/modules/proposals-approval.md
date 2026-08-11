# Tờ Trình — Đề Xuất (Proposals / Submissions) — PRO
**Module:** `PRO` | Người dùng: Tất cả nhân viên (tạo), TP/KT/CEO (duyệt) | Ưu tiên: 🟢 P3

Module quản lý quy trình đề xuất và phê duyệt nội bộ — từ xin ngân sách, mua sắm TSCĐ đến ký hợp đồng — theo **luồng duyệt đa cấp** (1–3 level) tùy theo loại tờ trình.

---

## 1. Tổng Quan Nghiệp Vụ

### 1.1 Mục tiêu
- **Số hóa** toàn bộ quy trình đề xuất nội bộ (thay thế email/giấy)
- **Phê duyệt đa cấp** theo ma trận phân quyền (TP → KT Trưởng → CEO)
- **Truy vết đầy đủ** — ai duyệt, lúc nào, bình luận gì
- **Tích hợp CEO Dashboard** — CEO nhìn thấy tờ trình chờ duyệt ngay khi mở app

### 1.2 Vai trò
| Vai trò | Quyền |
|---------|-------|
| Nhân viên | Tạo, sửa (DRAFT/RETURNED), trình duyệt, comment |
| TP Bộ Phận (Cấp 1) | Duyệt/Từ chối/Trả lại tờ trình cấp 1 |
| KT Trưởng (Cấp 2) | Duyệt/Từ chối/Trả lại tờ trình cấp 2 |
| CEO (Cấp 3) | Duyệt cuối, từ chối, trả lại; xem tất cả tờ trình |

---

## 2. Luồng Trạng Thái (Status Flow)

```
DRAFT → SUBMITTED → [REVIEWING/APPROVED_L1/APPROVED_L2] → APPROVED → IN_PROGRESS → CLOSED
         ↓                    ↓
     RETURNED ←──────── (Trả lại)
         ↓
      REJECTED
         ↓
     CANCELLED
```

| Trạng thái | Ý nghĩa | Màu |
|------------|---------|-----|
| `DRAFT` | Bản nháp, chưa trình | #4A6A7A |
| `SUBMITTED` | Đã trình, chờ cấp đầu tiên duyệt | #4A8FAB |
| `REVIEWING` | Đang xem xét (chuyển cấp) | #D4A853 |
| `RETURNED` | Trả lại để bổ sung | #C45A2A |
| `APPROVED_L1` | TP đã duyệt, chờ cấp tiếp | #5BA88A |
| `APPROVED_L2` | KT đã duyệt, chờ CEO | #5BA88A |
| `APPROVED` | CEO đã duyệt ✓ | #5BA88A |
| `REJECTED` | Từ chối | #8B1A2E |
| `IN_PROGRESS` | Đang thực hiện (hậu duyệt) | #87CBB9 |
| `CLOSED` | Hoàn tất | #4A6A7A |
| `CANCELLED` | Huỷ bỏ | #4A6A7A |

---

## 3. Ma Trận Phân Quyền & Luồng Duyệt Động (Dynamic Approval Matrix)

Hệ thống hỗ trợ **cấu hình hoàn toàn động** tại trang **Ma Trận Phân Quyền** (`/dashboard/settings/approval-matrix`):

1. **Tùy chỉnh Số Cấp Duyệt (Step Count):** Chủ động thiết lập từ 1 cấp đến 4 cấp duyệt cho từng loại tờ trình.
2. **Gán Role Duyệt Theo Cấp (Step Role Assignment):** Chọn cụ thể Role phụ trách duyệt ở từng bước (VD: Cấp 1 = `SALES_MGR`, Cấp 2 = `KE_TOAN`, Cấp 3 = `CEO`...).
3. **Phân Quyền Role Được Tạo (Creator Role Permissions):** Chọn các Role được quyền mở form tạo loại tờ trình tương ứng (trống = tất cả Role).
4. **Cơ chế Lưu Cấu Hình (`ApprovalConfig`):** Dữ liệu lưu trong bảng `approval_configs` với key `proposal.<CATEGORY>` chứa JSON `{ creatorRoles: [...], steps: [{ level: 1, role: '...' }, ...] }`. Khi khởi tạo hoặc duyệt tờ trình, server action sẽ tự động áp dụng đúng luồng đã thiết lập trong DB.

---

| Loại Tờ Trình | Code | Cấp Duyệt Mặc Định | Role Tạo Mặc Định |
|---|---|---|---|
| **Tờ Trình Tasting (Thử Rượu)** | `TASTING` | Cấp 1 (TP.KD) ➔ Cấp 2 (KT.Trưởng) ➔ Cấp 3 (CEO) | Sales Rep, Sales Admin, CBO, Admin |
| **Cơ Chế Giá** | `PRICE_ADJUSTMENT` | Cấp 1 (TP.KD) ➔ Cấp 2 (KT.Trưởng) ➔ Cấp 3 (CEO) | Sales Rep, Sales Admin, CBO, Admin |
| **Xin Ngân Sách** | `BUDGET_REQUEST` | Cấp 1 (TP) ➔ Cấp 2 (KT) ➔ Cấp 3 (CEO) | Tất cả |
| **Mua Sắm TSCĐ** | `CAPITAL_EXPENDITURE` | Cấp 1 (TP) ➔ Cấp 2 (KT) ➔ Cấp 3 (CEO) | Tất cả |
| **NCC Mới** | `NEW_SUPPLIER` | Cấp 1 (Thu Mua) ➔ Cấp 2 (CEO) | Thu Mua, Admin |
| **Sản Phẩm Mới** | `NEW_PRODUCT` | Cấp 1 (Thu Mua) ➔ Cấp 2 (CEO) | Thu Mua, CBO, Admin |
| **Thay Đổi Chính Sách** | `POLICY_CHANGE` | Cấp 1 (CEO) | CEO, Admin |
| **Lịch Thanh Toán** | `PAYMENT_SCHEDULE` | Cấp 1 (KT) ➔ Cấp 2 (CEO) | Kế Toán, Admin |

> **Quy trình Liên Kết Tờ Trình Tasting & Đơn Hàng Tasting (0 VNĐ)**:
> 1. Sales lập **Tờ Trình Tasting (`category: TASTING`)** chọn Khách hàng và **chọn chi tiết các mã sản phẩm (SKUs) kèm Số Lượng (chai)** cần nếm thử (thủ công hoặc chọn nhanh hàng loạt).
> 2. Tờ trình được duyệt qua 3 cấp (TP ➔ KT ➔ CEO).
> 3. Sau khi Tờ trình được duyệt (`APPROVED`), nút **`🍷 + Lên Đơn Tasting Ngay`** xuất hiện trên Drawer chi tiết Tờ trình.
> 4. Nhấp nút (hoặc chọn Tờ trình Tasting trong dropdown của `CreateSODrawer`) sẽ **TỰ ĐỘNG NẠP CHÍNH XÁC DANH SÁCH MÃ SẢN PHẨM & SỐ LƯỢNG (QTY)** từ Tờ trình sang bảng sản phẩm đơn hàng, gán đơn giá 0 VNĐ và điều khoản thanh toán *"TASTING - Không thu tiền"*.
> 5. Tờ trình lưu lịch sử danh sách các Đơn Bán Hàng Tasting đã phát sinh (`salesOrders`) kèm link truy cập nhanh.

---

## 4. Database Schema

### 4.1 `Proposal` (proposals)
| Field | Type | Mô tả |
|-------|------|-------|
| `id` | cuid | Primary key |
| `proposalNo` | String | Mã tờ trình: TT-YYYY-NNN |
| `category` | ProposalCategory | 14 loại (xem bảng trên) |
| `priority` | ProposalPriority | LOW / NORMAL / HIGH / URGENT |
| `title` | String | Tiêu đề |
| `content` | Text | Nội dung chi tiết |
| `justification` | Text? | Lý do / Căn cứ |
| `expectedOutcome` | Text? | Kết quả kỳ vọng |
| `estimatedAmount` | Decimal? | Giá trị ước tính |
| `currency` | String | VND / USD / EUR |
| `deadline` | DateTime? | Hạn hoàn thành |
| `status` | ProposalStatus | 11 trạng thái |
| `currentLevel` | Int | Cấp đang chờ duyệt (0,1,2,3) |
| `createdBy` | → User | Người tạo |
| `departmentId` | → Department? | Phòng ban |

### 4.2 `ProposalAttachment` (proposal_attachments)
- `proposalId`, `fileName`, `fileUrl`, `fileType`, `fileSize`

### 4.3 `ProposalComment` (proposal_comments)
- `proposalId`, `authorId`, `content`, `isInternal`

### 4.4 `ProposalApprovalLog` (proposal_approval_logs)
- `proposalId`, `level`, `action` (APPROVE/REJECT), `approvedBy`, `comment`

---

## 5. Giao Diện (UI)

### 5.1 Trang Danh Sách (`/dashboard/proposals`)
- **Stat cards**: Tổng cộng, Đang chờ duyệt, Đã duyệt, Từ chối, Nháp
- **Bộ lọc**: Trạng thái, Loại tờ trình
- **Bảng**: Mã TT, Loại, Ưu tiên, Tiêu đề, Giá trị, Trạng thái, Người tạo, Ngày
- **Nút tạo mới**: Drawer với form đầy đủ

### 5.2 Chi Tiết Tờ Trình (Drawer)
- Thông tin chung + nội dung + căn cứ + kết quả kỳ vọng
- **Timeline duyệt**: Hiển thị lịch sử duyệt theo cấp
- **Hành động**: Duyệt / Từ chối / Trả lại (tuỳ vai trò + cấp hiện tại)
- **Bình luận**: Thêm comment, phân loại Internal/Public
- **File đính kèm**: Upload multiple files

### 5.3 Tích hợp CEO Dashboard
- **KPI Card "Chờ CEO Duyệt"**: Gộp PO + SO + Tờ Trình
- **Widget "Tờ Trình Chờ Duyệt"**: Danh sách tờ trình currentLevel = 3
- **Nút "Xem & Duyệt"**: Mở drawer chi tiết ngay từ dashboard

---

## 6. Server Actions

| Action | Mô tả |
|--------|-------|
| `getProposals(filters)` | Danh sách tờ trình (lọc status/category/creator) |
| `getProposalDetail(id)` | Chi tiết + attachments + comments + approval logs |
| `createProposal(input)` | Tạo mới (status = DRAFT) |
| `updateProposal(id, input)` | Sửa (chỉ DRAFT/RETURNED) |
| `submitProposal(id, userId)` | Trình duyệt → SUBMITTED + routing |
| `processProposalApproval(input)` | Duyệt/Từ chối/Trả lại |
| `addProposalComment(input)` | Thêm bình luận |
| `getProposalStats()` | Thống kê cho stat cards |
| `getPendingProposalsForCEO()` | Tờ trình chờ CEO (level = 3) |
| `updateProposalStatus(id,status)` | Chuyển IN_PROGRESS/CLOSED/CANCELLED |

---

## 7. Implementation Status ✅

| Tính năng | Trạng thái |
|-----------|-----------|
| Prisma models (4 bảng) | ✅ Hoàn thành |
| Server actions (10 functions) | ✅ Hoàn thành |
| Trang danh sách + stat cards | ✅ Hoàn thành |
| Form tạo mới (drawer) | ✅ Hoàn thành |
| Chi tiết tờ trình (drawer) | ✅ Hoàn thành |
| Phê duyệt đa cấp (3 levels) | ✅ Hoàn thành |
| Timeline duyệt | ✅ Hoàn thành |
| Bình luận | ✅ Hoàn thành |
| Tích hợp CEO Dashboard | ✅ Hoàn thành |
| Sidebar navigation | ✅ Hoàn thành |
| Seed data (12 proposals) | ✅ Hoàn thành |
| Ma trận phân quyền (cấu hình) | ✅ Hoàn thành |

---

*Last updated: 2026-03-08 | Wine ERP v5.2*
