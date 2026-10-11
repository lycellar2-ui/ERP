# Kế Hoạch Xây Dựng Phân Hệ Quy Trình Doanh Nghiệp (SOP Knowledge Hub) — Wine ERP

> **Slug:** `sop-knowledge-hub-plan`  
> **Mục tiêu:** Xây dựng phân hệ tra cứu quy trình vận hành chuẩn (SOP Knowledge Hub) tại `/dashboard/sop` giúp nhân viên nắm bắt toàn bộ luồng nghiệp vụ của công ty (Bán hàng, Kho, Mua hàng, Kế toán, Nhân sự, POS...) một cách trực quan, có sơ đồ luồng từng bước, trách nhiệm RACI và checklist tự kiểm tra, giảm thiểu tối đa nhu cầu training thủ công.

---

## 📋 THÔNG TIN QUYẾT ĐỊNH (User Constraints & Decisions)

1. **Vị trí & Hình thức:** Trang tra cứu độc lập `/dashboard/sop` dạng Thư viện / Wiki nội bộ chuẩn mực, phân loại theo phòng ban.
2. **Nội dung & Trực quan:** Sơ đồ luồng trực quan (Visual Step Flowchart) + Checklist kiểm tra + RACI matrix + Biểu mẫu đính kèm + Link tắt sang các màn hình thao tác ERP tương ứng.
3. **Lưu trữ dữ liệu:** Lưu tĩnh dạng TypeScript Data (`wine-erp/src/data/sops.ts`), zero DB overhead, không cần migration, dễ cập nhật và bảo trì.
4. **Quyền truy cập:** Mọi nhân viên đã đăng nhập đều có thể truy cập tra cứu (không chặn permission, có gắn vào Sidebar nhóm "Tổng Quan").

---

## 🛠️ DANH SÁCH CÁC TÁC VỤ (Task Breakdown)

### Task 1: Thiết Kế Data Model & Bộ Dữ Liệu SOP Chuẩn Của Wine ERP
- **File:** `wine-erp/src/data/sops.ts`
- **Nội dung:** Định nghĩa TypeScript interfaces (`SopCategory`, `SopStep`, `SopItem`, `RaciMatrix`) và nạp sẵn 6 bộ quy trình chuẩn của công ty:
  1. *Quy trình Bán hàng, Phê duyệt Chiết khấu & Xuất hóa đơn* (`/dashboard/sales`)
  2. *Quy trình Nhập kho, Kiểm đếm & Dán tem rượu* (`/dashboard/warehouse`, `/dashboard/stamps`)
  3. *Quy trình Xuất kho giao hàng & Thu tiền COD* (`/dashboard/warehouse`, `/dashboard/delivery`)
  4. *Quy trình Tạo Đơn Mua Hàng Quốc Tế & Phê duyệt PO* (`/dashboard/procurement`)
  5. *Quy trình Lập Đề Nghị Thanh Toán & Phê Duyệt Đa Cấp* (`/dashboard/payment-requests`)
  6. *Quy trình Tiếp nhận Nhân sự mới & Bàn giao tài sản* (`/dashboard/hr`)
- **Verification:** Import TypeScript không có lỗi type check.

### Task 2: Xây Dựng Giao Diện Phân Hệ SOP Hub (`/dashboard/sop`)
- **Files:** 
  - `wine-erp/src/app/dashboard/sop/page.tsx` (Server Component - metadata & wrapper)
  - `wine-erp/src/app/dashboard/sop/loading.tsx` (Skeleton loading theo quy tắc Wine ERP)
  - `wine-erp/src/app/dashboard/sop/SopCatalogClient.tsx` (Client Component - tìm kiếm, filter theo phòng ban, danh sách quy trình)
- **Features:**
  - Thanh tìm kiếm thông minh (tìm theo tên quy trình, mã bước, phòng ban, vai trò).
  - Bộ lọc danh mục (Tất cả, Kinh doanh, Kho vận, Mua hàng, Tài chính - Kế toán, Nhân sự, POS).
  - Card hiển thị tóm tắt: Icon, thời gian thực hiện ước tính, phòng ban phụ trách, số bước thực hiện.
- **Verification:** Truy cập `/dashboard/sop` hiển thị mượt mà, tìm kiếm và lọc hoạt động tức thì.

### Task 3: Xây Dựng Component Trình Diễn Quy Trình Trực Quan (Visual Flowchart & Step Detail)
- **File:** `wine-erp/src/app/dashboard/sop/SopDetailModal.tsx` hoặc `SopDetailView.tsx`
- **Features:**
  - Sơ đồ luồng trực quan dạng Stepper/Pipeline (Step 1 -> Step 2 -> Step 3...) với màu sắc rõ ràng (chuẩn quy tắc No Violet).
  - Bảng ma trận RACI (Ai chịu trách nhiệm, Ai phê duyệt, Ai hỗ trợ, Ai nhận tin).
  - Chi tiết từng bước: Ai làm, Hành động gì, Link bấm chuyển sang màn hình thao tác ERP, Tài liệu/Biểu mẫu cần chuẩn bị, Cảnh báo lỗi hay gặp.
  - Interactive Checklist: Nhân viên có thể tích thử các đầu việc để tự kiểm tra trước khi bấm hoàn thành nghiệp vụ.
  - Nút In / Xuất SOP hoặc chia sẻ link nội bộ.
- **Verification:** Click vào bất kỳ quy trình nào xem được toàn bộ chi tiết, bấm link chuyển hướng đúng màn hình ERP tương ứng.

### Task 4: Tích Hợp Vào Navigation Sidebar & Kiểm Tra Phân Quyền
- **File:** `wine-erp/src/components/layout/Sidebar.tsx`
- **Nội dung:** Thêm mục `{ href: '/dashboard/sop', icon: BookOpen, label: 'Quy Trình Chuẩn (SOP)', labelEn: 'SOP & Guidelines' }` vào nhóm "Tổng Quan" hoặc "Hệ Thống" để nhân viên các phòng ban dễ dàng bấm vào xem.
- **Verification:** Mở menu sidebar trên cả Desktop và Mobile đều thấy link SOP Hub.

### Task 5: Cập Nhật Tài Liệu Dự Án (Docs Sync Protocol — P0)
- **Files:**
  - Tạo `docs/modules/sop.md` mô tả phân hệ SOP
  - Cập nhật bảng Module trong `docs/README.md` (tăng số dashboard route, sidebar items)
  - Cập nhật `docs/llms.txt`
  - Cập nhật `CODEBASE.md`
- **Verification:** Không vi phạm Docs Sync Protocol.

---

## 🏁 Phase X: Kiểm Thử & Nghiệm Thu (Verification & Review)
1. **Kiểm tra TypeScript:** Chạy kiểm tra lỗi type cho toàn bộ file mới.
2. **Kiểm tra UI/UX:** Đảm bảo responsive trên cả mobile và desktop, tuân thủ bảng màu token hiện có, không vi phạm Purple Ban.
3. **Kiểm tra Docs Sync:** Kiểm tra tất cả file tài liệu đã được đồng bộ chuẩn xác.
