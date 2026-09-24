# Phân Hệ Quản Lý Hồ Sơ & Giấy Tờ Nhân Viên (HRM & Employee Document Hub)

> **Mã phân hệ:** `HRM`  
> **Đường dẫn:** `/dashboard/hr`  
> **Quyền truy cập:** `HRM:READ`, `HRM:WRITE`, `HRM:DOC_MANAGE`, `HRM:DELETE`  
> **Vai trò quản trị:** CEO, Admin, Trợ Lý, Hành Chính Nhân Sự (HCNS)  
> **Trạng thái:** ✅ Đã hoàn thành (Giai đoạn 1)

---

## 1. Giới Thiệu Tổng Quan
Phân hệ cung cấp giải pháp số hóa toàn diện hồ sơ nhân viên, quản lý thông tin định danh, công tác, tài chính, hợp đồng lao động và kho giấy tờ pháp lý/chứng chỉ kèm cơ chế cảnh báo thời hạn tự động kép:
1. **Cảnh báo giao diện:** Thẻ KPI và banner đổi màu vàng/đỏ khi Hợp đồng lao động hoặc Giấy khám sức khỏe sắp hết hạn (&le; 30 ngày) hoặc đã quá hạn.
2. **Cảnh báo thông báo (Bell):** Tự động phát sinh thông báo hệ thống tới quả chuông Header của Ban Giám Đốc và Trợ Lý.
3. **Liên kết tài khoản ERP:** Cho phép tùy chọn liên kết hồ sơ nhân sự với tài khoản đăng nhập người dùng ERP hiện có.

---

## 2. Mô Hình Dữ Liệu (Database Models)

### 2.1. Model `Employee` (`employees`)
- **Khóa chính:** `id` (CUID)
- **Mã nhân viên:** `code` (String, unique, định dạng `NV-001`, `NV-002`...)
- **Liên kết User:** `userId` (String?, unique, quan hệ 1-1 với `User`)
- **Thông tin cá nhân:** `fullName`, `avatarUrl`, `gender`, `dateOfBirth`, `phone`, `email`
- **Định danh công dân:** `nationalId` (Số CCCD), `nationalIdDate`, `nationalIdPlace`
- **Địa chỉ:** `address` (Thường trú), `currentAddress` (Nơi ở hiện nay)
- **Liên hệ khẩn cấp:** `emergencyContact`, `emergencyPhone`, `emergencyRelation`
- **Công tác:** `deptId` (Phòng ban), `position` (Chức danh/vị trí), `status` (`ACTIVE`, `PROBATION`, `ON_LEAVE`, `RESIGNED`), `startDate`, `officialDate`
- **Hợp đồng lao động:** `contractType`, `contractNumber`, `contractStartDate`, `contractEndDate` (hạn HĐ để tính cảnh báo)
- **Tài chính & Thuế:** `bankAccountNo`, `bankName`, `bankAccountHolder`, `taxCode`, `socialInsuranceNo`
- **Sức khỏe định kỳ:** `healthCheckDate`, `healthCheckExpiry` (hạn KSK để tính cảnh báo)
- **Quan hệ:** `documents` (1-n với `EmployeeDocument`)

### 2.2. Model `EmployeeDocument` (`employee_documents`)
- **Khóa chính:** `id` (CUID)
- **Nhân viên:** `employeeId` (String, onDelete: Cascade)
- **Loại giấy tờ:** `docType` (`CONTRACT`, `NATIONAL_ID`, `DEGREE_CERT`, `HEALTH_CERT`, `CV`, `OTHER`)
- **Tên giấy tờ:** `title` (String)
- **Số hiệu văn bản:** `docNumber` (String?)
- **Đường dẫn tệp:** `fileUrl` (Supabase Storage: bucket `erp-files`), `filePath`, `fileType`, `fileSize`
- **Thời hạn hiệu lực:** `issueDate` (Ngày cấp/ký), `expiryDate` (Ngày hết hạn - để kích hoạt cảnh báo)
- **Trạng thái:** `status` (`ACTIVE`, `EXPIRED`, `ARCHIVED`)

---

## 3. Kiến Trúc Phân Quyền (RBAC Matrix)

| Vai trò | Quyền xem | Quyền tạo/sửa | Quản lý giấy tờ |
| :--- | :--- | :--- | :--- |
| **CEO / Admin / Trợ Lý / HCNS** | Toàn bộ nhân sự công ty | Toàn quyền tạo mới, chỉnh sửa, liên kết User | Tải lên, xem trước, tải về, xóa giấy tờ |
| **Quản lý bộ phận** | Chỉ xem nhân sự thuộc phòng ban quản lý | Xem thông tin công tác & liên hệ | Xem tài liệu nghiệp vụ |
| **Nhân viên (Self-service)** | Chỉ xem hồ sơ của chính mình | Cập nhật thông tin liên hệ, gửi giấy tờ mới | Xem giấy tờ cá nhân |

---

## 4. Danh Sách Tệp Mã Nguồn

| Đường dẫn tệp | Chức năng |
| :--- | :--- |
| `src/app/dashboard/hr/page.tsx` | Server Component tải dữ liệu ban đầu |
| `src/app/dashboard/hr/HrClient.tsx` | Giao diện chính, bộ lọc tìm kiếm, bảng dữ liệu, KPI cards |
| `src/app/dashboard/hr/EmployeeDetailDrawer.tsx` | Drawer chi tiết hồ sơ 4 tab, kho giấy tờ số hóa |
| `src/app/dashboard/hr/EmployeeFormModal.tsx` | Modal tạo mới và chỉnh sửa hồ sơ nhân viên |
| `src/app/dashboard/hr/DocumentUploadModal.tsx` | Modal tải lên giấy tờ (PDF/Ảnh) lên Supabase Storage |
| `src/app/dashboard/hr/actions.ts` | Server Actions xử lý CRUD, cảnh báo hạn và liên kết User |
| `scripts/seed_hr_employees.ts` | Script khởi tạo dữ liệu mẫu và hồ sơ khởi đầu |
