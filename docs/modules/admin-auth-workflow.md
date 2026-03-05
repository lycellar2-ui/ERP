# System Administration & Workflow Engine (Quản trị Hệ thống & Phê duyệt)

Để hệ thống ERP chạy theo kỷ luật của doanh nghiệp trị giá cao như kinh doanh rượu vang, việc ai được làm gì (Authorization) và ai phải duyệt cho ai (Approval Workflow) cực kỳ khắt khe. Phân hệ Admin đóng vai trò là "Xương sống bảo mật" của tất cả các luồng dữ liệu.

## 1. Hệ thống Phân Quyền Động (Dynamic RBAC) 

Thay vì hardcode cứng các chức vụ (Ví dụ: `ROLE_ACCOUNTANT`, `ROLE_SALES`), hệ thống này mang lại giao diện quản lý linh hoạt để System Admin (hoặc CEO) tự thiết lập.

### A. Cấu trúc Mô hình (Structure)
- **Tài khoản (Users):** Nhân sự cụ thể (Ví dụ: Nguyễn Văn A).
- **Phòng ban (Departments):** Phân nhóm tổ chức (Kho HCM, Sales HN, Kế Toán). 
- **Vai trò (Roles / Job Titles):** Ví dụ: "Kế toán Chi nhánh", "Trưởng phòng Mua hàng".
- **Quyền hạn (Permissions / Cấu hình Chức năng):** Đơn vị nhỏ nhất. (Ví dụ: `View_LandedCost`, `Create_PO`, `Approve_TaxForm`, `Edit_MasterData_Wine`).

### B. Admin Setup Module
Giao diện trực quan để Admin kéo thả, gán:
1. **Phân quyền theo chức năng cụ thể:** Nhân viên kho (Warehouse) chỉ có thể thao tác `Nhập Tồn Đầu`, `Nhặt Hàng (Pick)` nhưng hoàn toàn bị **chặn hiển thị cột Giá trị tiền (Giá Vốn/Hóa Đơn)**. 
2. **Kế thừa quyền theo Phòng ban:** User được assign vào Phòng Sales Mền Nam sẽ kế thừa tất cả các Permission cơ bản của phòng đó lập tức (Xem Data KH miền Nam, Xem Allocation miền Nam).
3. **Impersonation (Tính năng đặc quyền):** Trợ lý CEO hoặc IT Admin có nút "Login dưới tư cách User X" để hỗ trợ khắc phục sự cố mà không cần xin mật khẩu của họ.

## 2. Hệ thống Luồng Phê Duyệt Động (Approval Workflows)

Chức năng "Trình Duyệt" giúp CEO không phải ký giấy tay, mọi thứ nằm trên ERP và có tính pháp lý nội bộ.

### A. Logic Thiết lập Mẫu phê duyệt
Admin có thể thiết lập:
- **Loại Chứng Từ (Document Type):** Đơn Mua Hàng (PO), Đơn Bán Hàng (SO), Phiếu Chi, Giảm Giá (Discount SO), Hủy/Bể Vỡ kho (Write-off).
- **Ngưỡng kiểm soát (Thresholds):** SO dưới 50 triệu -> Trưởng Sales duyệt. SO trên 50 triệu hoặc chiết khấu > 15% -> Ép buộc đẩy lên CEO duyệt.
- **Số cấp duyệt (Multi-level):** Trình tự: Người lập (Draft) -> TP Mua hàng (Review) -> Kế toán trưởng (Check budget) -> CEO (Final Approve) -> Hệ thống tự động đẩy trạng thái thành `APPROVED` và cho phép thực thi (phát hành Lệnh nhập/xuất kho tương ứng).

### B. Cấu trúc Database cho Workflow
Sẽ cần thiết kế engine trung tâm (State Machine) thay vì dùng code `if/else` chắp vá:
- `ApprovalTemplate`: Lưu chuỗi các bước duyệt ứng với mỗi Loại chứng từ.
- `ApprovalRequest`: Thực thể đại diện cho 1 lần xin duyệt (Gắn với một PO/SO id cụ thể).
- `ApprovalStall`: Lưu chốt chặn hiện tại đang ở User/Role nào (Tích hợp chuông Notification hoặc Email nhắc nhở).
- `ApprovalLog / Audit Trail`: Lịch sử lưu vết cực đoan (User nào bấm duyệt vào lúc mấy giờ, theo địa chỉ IP nào). Không ai có thể chối bỏ trách nhiệm nếu đã ấn "Approve" lô hàng.

## 3. Hoạt động trên Executive Dashboard
Trên màn hình của CEO và các Trưởng phòng sẽ xuất hiện một Khu Vực Đặc Biệt:
- **"Pending My Approvals / Cần Tôi Duyệt":** Hiển thị danh sách dạng Kanban/Table các chứng từ đang chờ, CEO bấm vào có thể xem tổng quát số liệu tài chính của chứng từ trước khi ký điện tử (Click nút `Approve` hoặc `Reject` với lý do đính kèm).
