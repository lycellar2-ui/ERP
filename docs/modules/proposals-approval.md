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
| **Đào Tạo Nội Bộ** | `INTERNAL_TRAINING` | Cấp 1 (TP Bộ Phận) ➔ Cấp 2 (KT.Trưởng) ➔ Cấp 3 (CEO) | Tất cả nhân viên |
| **Tờ Trình Tasting (Thử Rượu)** | `TASTING` | Cấp 1 (TP.KD) ➔ Cấp 2 (KT.Trưởng) ➔ Cấp 3 (CEO) | Sales Rep, Sales Admin, CBO, Admin |
| **Cơ Chế Giá** | `PRICE_ADJUSTMENT` | Cấp 1 (TP.KD) ➔ Cấp 2 (KT.Trưởng) ➔ Cấp 3 (CEO) | Sales Rep, Sales Admin, CBO, Admin |
| **Xin Ngân Sách** | `BUDGET_REQUEST` | Cấp 1 (TP) ➔ Cấp 2 (KT) ➔ Cấp 3 (CEO) | Tất cả |
| **Mua Sắm TSCĐ** | `CAPITAL_EXPENDITURE` | Cấp 1 (TP) ➔ Cấp 2 (KT) ➔ Cấp 3 (CEO) | Tất cả |
| **NCC Mới** | `NEW_SUPPLIER` | Cấp 1 (Thu Mua) ➔ Cấp 2 (CEO) | Thu Mua, Admin |
| **Sản Phẩm Mới** | `NEW_PRODUCT` | Cấp 1 (Thu Mua) ➔ Cấp 2 (CEO) | Thu Mua, CBO, Admin |
| **Thay Đổi Chính Sách** | `POLICY_CHANGE` | Cấp 1 (CEO) | CEO, Admin |
| **Lịch Thanh Toán** | `PAYMENT_SCHEDULE` | Cấp 1 (KT) ➔ Cấp 2 (CEO) | Kế Toán, Admin |

> **Quy trình Tờ Trình Đào Tạo Nội Bộ & Hàng Mẫu Thử Nếm (Training Samples)**:
> 1. Nhân viên các phòng ban lập **Tờ Trình Đào Tạo Nội Bộ (`category: INTERNAL_TRAINING`)**, có thể đính kèm danh sách rượu vang dùng thử nếm trong buổi đào tạo (SKUs & Số lượng chai).
> 2. Luồng duyệt tự động 3 cấp: **Trưởng Bộ Phận (Cấp 1)** ➔ **Kế Toán Trưởng (Cấp 2 - kiểm soát ngân sách/chi phí mẫu)** ➔ **Tổng Giám Đốc (Cấp 3 - phê duyệt cuối)**.
> 3. Sau khi được duyệt (`APPROVED`), Drawer chi tiết hiển thị danh sách rượu mẫu kèm nút **`🍷 + Lên Đơn Xuất Mẫu Training`** để tạo nhanh đơn xuất hàng mẫu thử nếm 0 VNĐ trên hệ thống.

> **Quy trình Liên Kết Tờ Trình Tasting & Đơn Hàng Tasting (0 VNĐ)**:
> 1. Sales lập **Tờ Trình Tasting (`category: TASTING`)** chọn Khách hàng và **chọn chi tiết các mã sản phẩm (SKUs) kèm Số Lượng (chai)** cần nếm thử (thủ công hoặc chọn nhanh hàng loạt).
> 2. Tờ trình được duyệt qua 3 cấp (TP ➔ KT ➔ CEO).
> 3. Sau khi Tờ trình được duyệt (`APPROVED`), nút **`🍷 + Lên Đơn Tasting Ngay`** xuất hiện trên Drawer chi tiết Tờ trình.
> 4. Nhấp nút (hoặc chọn Tờ trình Tasting trong dropdown của `CreateSODrawer`) sẽ **TỰ ĐỘNG NẠP CHÍNH XÁC DANH SÁCH MÃ SẢN PHẨM & SỐ LƯỢNG (QTY)** từ Tờ trình sang bảng sản phẩm đơn hàng, gán đơn giá 0 VNĐ và điều khoản thanh toán *"TASTING - Không thu tiền"*.
> 5. Tờ trình lưu lịch sử danh sách các Đơn Bán Hàng Tasting đã phát sinh (`salesOrders`) kèm link truy cập nhanh.

> **Quy trình Tờ Trình Chương Trình Khuyến Mãi (CTKM 1 Mã, Mua X Tặng Y & Quota Hạn Mức)**:
> 1. Lập **Tờ Trình Chương Trình KM (`category: PROMOTION_CAMPAIGN`)**:
>    - **Phân loại kênh khách hàng**: Chọn các kênh áp dụng (Bán buôn `WHOLESALE_DISTRIBUTOR`, Doanh nghiệp `CORPORATE`, Bán lẻ `RETAIL`, HORECA `HORECA` hoặc Tất cả).
>    - **Thời gian áp dụng**: Chọn ngày bắt đầu (`startDate`) và ngày kết thúc (`endDate`).
>    - **Cơ chế Mua Hàng & Quà Tặng (1 mã)**: Chọn mã sản phẩm mua chính (SKU) kèm số lượng mua tối thiểu (X chai) ➔ Chọn cơ chế quà tặng: tặng cùng mã sản phẩm HOẶC tặng mã quà tặng khác (ly vang, khui rượu, chai khác) kèm số lượng tặng (Y chai 0 VNĐ).
>    - **Hạn mức Quota**: Thiết lập tổng số lượng quà tặng toàn chiến dịch (`maxTotalQty`) VÀ số lượng tối đa trên mỗi đơn hàng/mỗi khách (`maxQtyPerOrder`).
>    - **Dự toán ngân sách tự động**: Tự động tính toán ngân sách chiến dịch = `maxTotalQty * đơn giá quà tặng`.
> 2. Luồng duyệt 3 cấp tự động theo Ma trận phân quyền: **Trưởng Bộ Phận (Cấp 1) ➔ Kế Toán Trưởng (Cấp 2) ➔ Tổng Giám Đốc (Cấp 3)**.
> 3. **Tích hợp Tự Động Hóa trên Đơn Hàng (SO)**:
>    - Khi Sales lên đơn hàng bán (`CreateSODrawer`), hệ thống tự động kiểm tra thời hạn và kênh của khách hàng.
>    - Khi đơn hàng có dòng sản phẩm mua chính đạt số lượng >= X: Hệ thống hiển thị **Banner thông báo gợi ý quà tặng** nổi bật kèm nút bấm **`[ 🎁 + Thêm M Chai Quà Tặng (0 VNĐ) ]`** (đã tính theo tỷ lệ X/Y và áp trần `maxQtyPerOrder`).
>    - Sales bấm xác nhận để hệ thống chèn dòng quà tặng với đơn giá 0 VNĐ và nguồn giá `PROMOTION_GIFT`. Sales hoàn toàn chủ động xác nhận nhận quà, tránh tự ý nhồi dòng ngoài ý muốn.

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
- **Bản in & Xuất Song Ngữ (Bilingual Print Engine)**:
  - Hỗ trợ in văn bản song ngữ A4 chuẩn hành chính - thương mại quốc tế (Việt - Anh)
  - Bộ chọn chế độ in linh hoạt: **Bản Song Ngữ (Mặc định)**, **Bản Tiếng Việt**, **Bản Tiếng Anh**
  - Mẫu in **Tờ trình Tasting** (`TASTING`): Song ngữ toàn bộ bảng sản phẩm (SKU, Tên SP, ĐVT, SL, Giá tham khảo, Thành tiền, Mục đích), căn cứ pháp lý, quy chế ngân sách, lưu ý thuế GTGT & TNDN theo NĐ 181/2025/NĐ-CP & NĐ 70/2025/NĐ-CP, chữ ký 4 bên và Digital Audit Trail.
  - Mẫu in **Tờ trình Cơ chế giá** (`PRICE_ADJUSTMENT`): Song ngữ thông tin khách hàng, phạm vi, thời hạn, % chiết khấu, bảng giá đề xuất theo SKU, căn cứ đề xuất, kết quả kỳ vọng và bảng tiến trình ký duyệt điện tử.

### 5.3 Tích hợp CEO Dashboard
- **KPI Card "Chờ CEO Duyệt"**: Gộp PO + SO + Tờ Trình
- **Widget "Tờ Trình Chờ Duyệt"**: Danh sách tờ trình currentLevel = 3
- **Nút "Xem & Duyệt"**: Mở drawer chi tiết ngay từ dashboard

### 5.4 Giao Diện Song Ngữ Toàn Diện (Bilingual UI Support — VI / EN)
- **Hệ thống từ điển tập trung (`i18n.ts`)**: Cung cấp cấu trúc đa ngữ `PROPOSALS_I18N` (`vi` và `en`) đồng nhất cho toàn module Tờ Trình.
- **Tích hợp `useAppLocale()`**: Đồng bộ tức thời theo nút chuyển ngữ toàn hệ thống `VI | EN` trên Header (lưu trữ tại `localStorage.erp_locale`), kích hoạt custom event thông báo giữa các components.
- **Tự động tách & định dạng tiêu đề song ngữ (`formatBilingualTitle`)**:
  - Đối với các tờ trình có tiêu đề song ngữ định dạng chuẩn `Tiêu đề Tiếng Việt / English Title`, hệ thống tự động nhận diện dấu gạch chéo cách khoảng (` / `).
  - Khi người dùng chọn **VI**: Tiêu đề Tiếng Việt hiển thị chính (in đậm), tiêu đề Tiếng Anh hiển thị phụ (in nghiêng xám bên dưới).
  - Khi người dùng chọn **EN**: Tiêu đề Tiếng Anh tự động hiển thị chính (in đậm), tiêu đề Tiếng Việt hiển thị phụ (in nghiêng xám bên dưới).
- **Trang danh sách & Bảng điều khiển**:
  - 5 thẻ thống kê KPI (Tổng, Chờ duyệt, Bản nháp, Đã duyệt, Từ chối).
  - 5 tab lọc trạng thái và các dropdown lọc (Loại tờ trình, Mức độ ưu tiên, Ô tìm kiếm).
  - Bảng dữ liệu 10 cột trên desktop và giao diện thẻ trên mobile, nhãn trạng thái và mức độ ưu tiên theo ngôn ngữ đang chọn.
- **Drawer Tạo mới (`CreateDrawer`)**:
  - Toàn bộ nhãn form, placeholder hướng dẫn, nút lưu nháp, trình duyệt và thông báo xác thực được chuyển ngữ đầy đủ.
- **Drawer Chi tiết (`DetailDrawer`)**:
  - Tiêu đề drawer, bộ chọn ngôn ngữ in (Song ngữ, Tiếng Việt, Tiếng Anh).
  - Nhãn tiến trình phê duyệt 3 cấp, bảng chi tiết cơ chế giá/thử rượu/đơn hàng SO liên kết.
  - Bảng dấu vết kiểm toán điện tử (Digital Audit Trail), khu vực thảo luận, các nút Duyệt, Trả lại, Từ chối, Chuyển thực hiện và Đánh dấu hoàn tất.
- **Menu điều hướng Sidebar (`Sidebar.tsx`)**:
  - Bổ sung cấu trúc `labelEn` cho tất cả các nhóm menu (`NavGroup`) và từng mục chức năng (`NavItem`), tự động hiển thị Tiếng Anh hoặc Tiếng Việt theo ngôn ngữ người dùng lựa chọn.

---

## 6. Server Actions

| Action | Mô tả |
|--------|-------|
| `getProposals(filters)` | Danh sách tờ trình (sắp xếp createdAt giảm dần; lọc status/category/priority/creator) |
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
| Áp dụng cơ chế giá đa chi nhánh | ✅ Hoàn thành (Session 14 - 20/08/2026) |
| Sắp xếp theo thời gian & lọc theo mức độ ưu tiên | ✅ Hoàn thành (04/09/2026) |
| Tờ trình song ngữ (Form + Mẫu in Tasting & Cơ chế giá + Bộ chọn ngôn ngữ) | ✅ Hoàn thành (03/10/2026) |
| Chuyển đổi ngôn ngữ giao diện VI / EN (Sidebar + Proposals List + Form + Detail + Title Splitting) | ✅ Hoàn thành (04/10/2026) |
| Tờ trình CTKM 1 mã (Mua X tặng Y, Kênh bán buôn/DN/bán lẻ/Horeca, Quota, Gợi ý quà tặng SO) | ✅ Hoàn thành (09/10/2026) |

---

*Last updated: 2026-10-09 22:30 | Wine ERP v10.9*
