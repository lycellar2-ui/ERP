# 🗺️ CODEBASE & AGENT INSTRUCTIONS — Wine ERP

> 🔴 **MANDATORY**: Tất cả AI Assistant/Agents khi làm việc tại dự án này PHẢI đọc và tuân thủ các quy tắc trong tài liệu `CODEBASE.md`. Đây là lớp bảo vệ tuyệt đối (Defense in Depth) chống lại Regression Bug (Hỏng logic khi sửa mới).

## 1. FILE DEPENDENCIES AWARENESS
Mỗi khi bạn có ý định sửa đổi `actions.ts` hoặc cập nhật Component của một module, bạn **BẮT BUỘC** phải xem qua tài liệu sau để không làm nứt gãy dữ liệu ở module kết nối:
1. `docs/architecture/module-dependencies.md` -> Hiểu rõ Module Chủ & Các Module Phụ Thuộc (Ví dụ: SLS gọi WMS tuyệt đối không can thiệp Code xử lý DB WMS).
2. `docs/architecture/data-flow.md` -> Xem danh sách RÀNG BUỘC CỨNG (Constraints). Ví dụ: cấm xóa SO đã xuất hóa đơn; cấm xóa Product/Customer hard-delete. Đọc tài liệu đó KHẮC CỐT ghi tâm trước khi viết logic `database interaction`.

## 2. STRICT 3-STEP WORKFLOW CHO MỌI CODE FUNCTION
Khi User yêu cầu Code / Chỉnh sửa Logic / Thêm Flow:
- **BƯỚC 1: TRA CỨU CONSTRAINT MANG TÍNH THIẾT KẾ**
  - Mở đọc file `docs/architecture/data-flow.md` để check quy tắc nào ràng buộc tính năng User đang yêu cầu.
  - Bổ sung `throw new Error(...)` vào hàm Server Action nếu request cố tình vi phạm luồng.
- **BƯỚC 2: VIẾT THEO RANH GIỚI MODULAR (DDD)**
  - Tích hợp theo ranh giới, không đụng vào `App/DB` của module khác. Nếu module khác không có API/Hàm xử lý, hãy VÀO module kia viết thêm một `Server Action` và sau đó ở module gốc thì import lại nó. Thiết lập "Single Source of Truth".
- **BƯỚC 3: KIỂM TRA LỖI TYPE (TypeScript Error Net)**
  - Hệ thống sử dụng Typescript Validation Type Checking làm Ràng Buộc Cao Nhất.
  - Luôn đảm bảo Typescript Build Không Lỗi (`npm run type-check` hay kiểm tra IDE errors).

## 3. PHÂN BỔ MODULES (APP ROUTER)
- **System/Admin**: `src/app/dashboard/settings`, `src/app/login`
- **Master Data**: `src/app/dashboard/products`, `src/app/dashboard/customers`, `src/app/dashboard/suppliers`
- **Warehouse**: `src/app/dashboard/warehouse`
- **Sales & Allocation**: `src/app/dashboard/sales`, `src/app/dashboard/quotations`, `src/app/dashboard/price-list`, `src/app/dashboard/allocation`
- **CRM**: `src/app/dashboard/crm`, `src/app/dashboard/pipeline`
- **Finance & Tem**: `src/app/dashboard/finance`, `src/app/dashboard/declarations`, `src/app/dashboard/stamps`
- **Procurement & Operations**: `src/app/dashboard/procurement`, `src/app/dashboard/contracts`, `src/app/dashboard/agency`
- **Tax & Market Data**: `src/app/dashboard/tax`, `src/app/dashboard/costing`, `src/app/dashboard/market-price`
- **Logistics**: `src/app/dashboard/delivery`, `src/app/dashboard/consignment`, `src/app/dashboard/transfers`, `src/app/dashboard/returns`, `src/app/dashboard/stock-count`
- **CEO Board**: `src/app/dashboard`, `src/app/dashboard/kpi`, `src/app/dashboard/reports`
- **AI & Features**: `src/app/dashboard/ai`
- **POS & QR**: `src/app/dashboard/pos` (Barcode scan, VAT Invoice), `src/app/dashboard/qr-codes` (Anti-counterfeit)
- **Market**: `src/app/dashboard/market-price`
