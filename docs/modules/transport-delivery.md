# Transportation & Delivery Module (Quản lý Vận chuyển & Giao nhận)

Phân hệ dành riêng cho đội ngũ Shipper/Giao Hàng - một chốt chặn cực kỳ nhạy cảm đối với ngành kinh doanh F&B nhập khẩu như rượu vang (Hàng hóa dễ vỡ, yêu cầu nhiệt độ bảo quản trong khi vận chuyển, giá trị cao).

## 1. Quản trị Chuyến xe nội bộ (Delivery Routing & Dispatch)
Màn hình trên Web Desk (Dành cho Điều phối viên / Warehouse Manager):
- Gói nhiều Đơn hàng bán (Sales Order) vào 1 Chuyến xe (Delivery Route) để tối ưu cung đường.
- Phân bổ tài xế (Shipper) / Xe tải phù hợp. (Ví dụ: Xe lạnh cho Grand Cru).
- Tính toán tải trọng (Weight) và thể tích khối (CBM) dựa trên thông số OWC/Carton từ Master Data để xe không bị quá tải.

## 2. Shipper Mobile App / Responsive Web View
Shipper không cần ngồi máy tính. Giao diện được thiết kế UI/UX trên kích thước màn hình điện thoại (Mobile First):
- Hiển thị danh sách Lộ trình giao hàng trong ngày (Daily Manifest).
- Nút tính năng gọi điện thoại nhanh cho người nhận (Touch-to-call).
- Map Integration: Mở vị trí trên Google Maps/Apple Maps.

## 3. Điện Tử Hóa Giao Nhận (E-POD - Electronic Proof of Delivery)
Kỷ nguyên ERP không còn dùng giấy tờ thủ công quá nhiều.
- **Chữ ký điện tử:** Màn hình canvas cho phép Đại lý/Khách hàng ký trực tiếp trên điện thoại của Shipper xác nhận đã nhận đủ vỏ hộp/chất lượng chai nguyên vẹn.
- **Chụp ảnh bằng chứng:** Shipper chụp lại hình thùng rượu vang tại địa điểm nhận và tải thẳng lên Cloud EPR.
- **Thu hộ (COD):** Ghi nhận trạng thái thanh toán ngay tại hiện trường. Tiền mặt hay Chuyển khoản (có API check báo có tài khoản ngân hàng nếu có thể).
- Đồng bộ Real-time: Ngay khi Shipper nhấn "Delivered", trạng thái SO trong Sales Module và Công nợ trong Finance Module cập nhật Tức thời, CEO thấy dòng tiền thay đổi trên Dashboard.

## 4. Reverse Logistics (Thu hồi hàng / Xử lý bể vỡ)
- Chức năng đặc biệt khi hàng đến nơi phát hiện bể vỡ (Breakage) trong quá trình vận chuyển. 
- Shipper nhập biên bản hao hụt ngay trên ERP mobile, Kho tự động ghi nhận Hàng Lỗi chờ xử lý (Quarantine), tự động tạo Credit Note trừ nợ cho khách hàng.
