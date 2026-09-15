# Procurement — Quản Lý Đơn Mua Hàng (PO)

> Phân hệ quản lý toàn bộ chu trình mua hàng nhập khẩu từ các Winery (Pháp, Ý, Tây Ban Nha, Mỹ, Úc, Chile...), tích hợp ma trận phê duyệt phân quyền, quy cách đóng gói thùng/chai, tỷ giá ngoại tệ và liên kết lô hàng vận chuyển B/L quốc tế.

---

## 1. Tổng Quan

- **Mục tiêu**: Chuẩn hóa luồng tạo PO, gửi trình duyệt đa cấp (TP Mua Hàng → Kế Toán → CEO), theo dõi tiến độ vận tải quốc tế và nhập kho.
- **Thiết kế UI đồng bộ**: Giao diện kế thừa 100% phong cách thiết kế hiện đại của Quản lý Đơn Hàng Bán (SO) với theme Dark `#0A1926`/`#142433`, thống kê inline, bộ lọc MISA thời gian đa năng và bảng dữ liệu chuyên nghiệp.

---

## 2. Truy Cập

| Thông tin | Giá trị |
|-----------|---------|
| **Sidebar** | `Mua Hàng & Nhập Khẩu → Đơn Mua Hàng (PO)` |
| **URL** | `/dashboard/procurement` |
| **Icon** | ShoppingCart (lucide-react) |
| **Phân quyền** | CEO, Admin, Purchasing Manager, Purchasing Staff, Kế Toán |

---

## 3. Tính Năng Chính

### 3.1 Giao Diện Đồng Bộ & Thống Kê
- **Inline Quick Stats trên Header**: Hiển thị nhanh số liệu `Tổng PO`, `Chờ duyệt`, `Đã duyệt`, `Đang trên tàu`, `Đã nhập đủ`.
- **Thống Kê Chi Tiết (Collapsible)**: Nút `📊 Thống Kê` mở rộng lưới card chỉ số `POStatCard` với chỉ báo màu sắc trực quan.
- **Tỷ Giá Ngoại Tệ (FX Modal)**: Tra cứu nhanh tỷ giá quy đổi EUR, USD, GBP, AUD, NZD sang VNĐ.
- **Xuất Excel 2 Sheet**: Xuất chi tiết dòng hàng sản phẩm và tổng hợp đơn mua hàng ra file Excel định dạng chuẩn.

### 3.2 Bộ Lọc Tinh Chỉnh Nhanh (Toolbar)
- **Status Tabs**: Lọc theo trạng thái (*Tất cả, Nháp, Chờ duyệt, Đã duyệt, Đang trên tàu, Nhận 1 phần, Đã nhận đủ, Đã huỷ*).
- **Bộ lọc thời gian MISA**: Tùy chọn nhanh (*Hôm nay, Hôm qua, Tuần này, Tuần trước, Tháng này, Quý này, Năm nay, Tùy chỉnh*) kèm 2 ô chọn ngày.
- **Bộ lọc mở rộng**: Lọc theo Pháp nhân nhập khẩu, Incoterms (*EXW, FOB, CIF, DDP*), Tiền tệ giao dịch.

### 3.3 Tạo & Chỉnh Sửa Đơn Mua Hàng (Create & Edit Draft PO)
- **Tạo đơn 2 tùy chọn linh hoạt (`CreatePODrawer`)**:
  - `[💾 Lưu Bản Nháp]`: Tạo và lưu đơn ở trạng thái `DRAFT` để người mua có thể xem lại, bổ sung dòng hàng, thương lượng thêm với Winery trước khi trình duyệt.
  - `[🚀 Tạo & Gửi Trình Duyệt]`: Tạo đơn và tự động khởi tạo luồng phê duyệt đa cấp ngay lập tức.
  - Badge trực quan `Bản Nháp (Draft)` trên tiêu đề drawer giúp người dùng nắm rõ trạng thái khởi tạo ban đầu.
- **Chỉnh sửa đơn Nháp toàn diện (`EditPODrawer`)**:
  - Cho phép sửa toàn bộ thông tin của đơn hàng ở trạng thái `DRAFT` (hoặc sau khi bị Từ chối / Thu hồi): thay đổi nhà cung cấp, pháp nhân, tiền tệ, tỷ giá, thêm/bớt sản phẩm, đổi quy cách thùng/chai, đơn giá thương mại, hàng FOC và chiết khấu.
  - Cung cấp 2 lựa chọn lưu: `[💾 Lưu Bản Nháp]` (tiếp tục giữ ở trạng thái nháp) hoặc `[🚀 Lưu & Gửi Duyệt]` (lưu thay đổi và gửi trình duyệt ngay).
- **Thu hồi về Nháp (`revertPOToDraft`)**:
  - Khi đơn đang ở trạng thái `PENDING_APPROVAL` nhưng phát hiện cần điều chỉnh trước khi cấp trên duyệt, người tạo có thể bấm `[↩️ Thu Hồi Về Nháp]` trực tiếp từ bảng hoặc từ Slide-over Chi Tiết PO.
- **Xoá đơn Nháp (`deletePurchaseOrder`)**:
  - Hỗ trợ xoá vĩnh viễn đơn mua hàng nháp không còn nhu cầu sử dụng để làm sạch dữ liệu, không ảnh hưởng tới dữ liệu vận tải hay kế toán kho.
- **Thanh tác vụ cố định (Sticky Action Footer)**:
  - Khi mở Slide-over Chi Tiết PO ở trạng thái `DRAFT`, thanh chân trang luôn hiển thị trực tiếp các nút: `[🗑️ Xoá Đơn]`, `[✏️ Sửa Đơn Nháp]` và `[📤 Gửi Trình Duyệt]` ở bất kỳ tab nào (Sản phẩm, Lô vận tải, Chứng từ).
- **Tìm kiếm SKU/Sản phẩm thông minh**: Tự động gợi ý theo mã SKU hoặc tên rượu vang có debounce và hiển thị cờ quốc gia.
- **Quy cách đóng gói linh hoạt**:
  - Hỗ trợ Thùng 6 chai (`CASE_6`), Thùng 12 chai (`CASE_12`), Thùng 3 chai (`CASE_3`), Thùng 1 chai (`CASE_1`) và Chai lẻ (`BOTTLE`).
  - Cho phép nhập giá theo Thùng hoặc theo Chai, tự động tính tổng số chai và đơn giá quy đổi.
- **Quản lý Giảm giá & Chiết khấu đơn hàng (Order Discounts)**:
  - Hỗ trợ 2 hình thức: **% Chiết khấu trên tổng tiền hàng** (`discountPct`) hoặc **Số tiền giảm trực tiếp** (`discountAmount`).
  - Tự động trừ tiền hàng trước giảm (`subtotal`) để tính ra tổng số tiền thực tế phải trả nhà cung cấp (`totalAmount`).
- **Hàng Quà Tặng / Hàng Mẫu FOC (Free of Charge Goods)**:
  - Checkbox `[x] Hàng FOC (Miễn phí)` trên từng dòng sản phẩm với trường ghi chú lý do (`focNote`: *Chai thử nếm tasting, Thưởng doanh số, Bù hao vỡ mẻ trước...*).
  - Tiền phải trả nhà cung cấp tự động bằng `0.00`.
  - Cho phép nhập **Đơn giá danh nghĩa hải quan** (`declaredPrice`): Tự động tính trị giá hải quan phục vụ khai báo tờ khai, áp thuế Nhập khẩu + Thuế TTĐB (35%-65%) và phân bổ chi phí Landed Cost khi hàng về cảng.
- **Quy đổi giá trị thời gian thực**: Tự động tính FOB Ngoại tệ, chiết khấu và quy đổi sang VNĐ dựa trên tỷ giá cấu hình.

### 3.4 Quy Trình Phê Duyệt Đa Cấp (Approval Matrix)
- Tích hợp theo cấu hình phân quyền trong `ApprovalConfig` (`procurement.purchase_order`).
- Hỗ trợ luồng duyệt linh hoạt qua các cấp:
  1. Trưởng phòng Mua Hàng / Thu Mua
  2. Kế Toán Trưởng
  3. Tổng Giám Đốc (CEO)
- Tự động ghi nhật ký lịch sử phê duyệt (`POApprovalLog`) và gửi thông báo In-app Notification cho các cấp phê duyệt liên quan.

---

## 4. Bảng Dữ Liệu & Vận Tải Quốc Tế

- Cột hiển thị đa thông tin:
  - **Mã PO & Vận tải**: Số PO, Incoterms, Vận đơn B/L, Tên tàu, Số container.
  - **Nhà cung cấp & Pháp nhân**: Quốc kỳ, Tên Winery/NCC, Pháp nhân nhập khẩu, Điều khoản thanh toán.
  - **Quy mô & Nhập kho**: Số lượng SKU, Tổng số chai (kèm badge `🎁 FOC: X chai` nếu có hàng tặng), Tiến độ nhập kho (%) với thanh tiến trình trực quan.
  - **Giá trị**: Tổng tiền ngoại tệ, Badge chiết khấu (`🏷️ -X USD`), Giá trị quy đổi VNĐ, Tỷ giá.
  - **Trạng thái & Thao tác**: Badge trạng thái, Thao tác nhanh (*Gửi duyệt, Phê duyệt, Từ chối, Nhập kho, Xem chi tiết*).
  - **Slide-over Chi Tiết PO**: Hiển thị bảng chi tiết các dòng sản phẩm, phân biệt rõ hàng thương mại và hàng FOC, giá hải quan, lý do FOC và thẻ tóm tắt tài chính (Subtotal, Discount, Total Payable, VNĐ).
