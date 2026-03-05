# Import Agency Portal (Cổng Cộng Tác Đại Lý Logistics / Hải Quan)

Phân hệ này mở ra một cổng web riêng biệt (subdomain hoặc section `/agency`) cho các đơn vị bên ngoài cộng tác — bao gồm: Đại lý Hải quan (Customs Broker), Công ty Forwarding (Freight Forwarder), Đại lý vận tải quốc tế — có thể đăng nhập và cập nhật trực tiếp thông tin liên quan đến lô hàng nhập khẩu vào hệ thống, thay thế hoàn toàn quy trình email/Zalo.

## 1. Mô Hình Truy Cập (Access Model)
- Agency được cấp tài khoản loại `EXTERNAL_PARTNER` — **không phải** tài khoản nội bộ
- Tài khoản Agency chỉ thấy đúng lô hàng mà họ được chỉ định phụ trách (`Shipment Scope Lock`)
- Mọi thao tác của Agency đều được Audit Trail ghi lại, và bộ phận Thu mua nội bộ phải **Review & Confirm** trước khi số liệu có hiệu lực trong ERP

---

## 2. Các Thông Tin Agency Có Thể Điền

### A. Thông tin Lô Hàng / Container
- Số vận đơn (Bill of Lading No.)
- Tên tàu / Hãng tàu
- Cảng xếp hàng (Port of Loading) / Cảng dỡ hàng (Port of Discharge)
- Ngày cập cảng dự kiến (ETA) — Cập nhật được khi tàu thay đổi lịch
- Số container, seal number
- Nhiệt độ container (Nếu hàng lạnh — Reefer Container)

### B. Chi Phí Hải Quan & Logistic
- Phí THC (Terminal Handling Charge)
- Phí D/O (Delivery Order)
- Phí lưu container / lưu bãi (nếu có)
- Phí mở tờ khai (Customs Declaration Fee)
- Phí kiểm hóa, kiểm định chất lượng (nếu có)
- Agency Upload được file PDF/Excel hóa đơn chi phí → Hệ thống tự parse vào LandedCostInvoice

### C. Dữ Liệu Tờ Khai Hải Quan
- Số Tờ Khai (Declaration No.)
- Ngày tờ khai được thông quan
- Phân loại HS Code của từng item trong lô
- Số tiền thuế NK / TTĐB / VAT đã nộp thực tế (Để đối chiếu với Tax Engine tính toán)
- Upload file PDF Tờ Khai Hải Quan chính thức

### D. Tracking Status (Cập nhật trạng thái vận chuyển)
- Agency update các milestone: `Order Confirmed → On Vessel → Arrived Port → Custom Cleared → Delivered to Warehouse`
- Mỗi milestone update sẽ đẩy notification vào hệ thống nội bộ (Thu mua, CEO Dashboard — Widget "In-Transit")

---

## 3. Quy Trình Duyệt (Review & Confirm)
1. Agency điền thông tin → Status: `PENDING_REVIEW`
2. Nhân viên Thu mua nội bộ nhận notification → Xem xét và đối chiếu chứng từ giấy
3. Nếu đúng → Click `Confirm & Import into ERP` → Số liệu này mới thực sự chạy vào PRC/WMS
4. Nếu sai → `Request Correction` kèm ghi chú → Agency nhận thông báo, sửa lại
5. Toàn bộ lịch sử vòng này được lưu audit trail

---

## 4. Lợi Ích
- **Loại bỏ nhập liệu kép:** Trước đây Thu mua phải copy từ email của Agency vào Excel. Giờ Agency nhập trực tiếp.
- **Giảm sai sót:** Agency phải điền đúng chuẩn form của hệ thống, không còn gửi số liệu tự do trong email.
- **Thời gian thực:** CEO thấy được ETA cặp nhật mới nhất của container trên Dashboard ngay khi Agency update.

---

## 5. Database Design
- `ExternalPartner`: Thực thể cho Agency bên ngoài (Khác hoàn toàn với User nội bộ)
- `PartnerShipmentAccess`: Bảng gán Agency phụ trách Shipment nào
- `AgencySubmission`: Thực thể chứa dữ liệu Agency submit, trạng thái review, ai confirm
- `AgencyDocument`: Upload file tờ khai, hóa đơn chi phí
