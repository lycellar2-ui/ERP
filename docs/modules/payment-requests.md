# Đề Nghị Thanh Toán & Quản Lý Ngân Sách — PRQ
**Module:** `PRQ` (Payment Requests & Expense Budgets) | Người dùng: Toàn bộ nhân viên (tạo), TP/KT/CEO (duyệt), Kế toán (giải ngân) | Ưu tiên: 🟢 P1

Phân hệ quản lý toàn diện quy trình lập đề nghị thanh toán nội bộ và thanh toán nhà cung cấp, lưu trữ chứng từ scan (Hóa đơn GTGT, Biên bản nghiệm thu, Hợp đồng, UNC) trên Cloudflare R2, phê duyệt đa cấp theo hạn mức và kiểm soát định mức ngân sách chi phí theo năm/quý/tháng.

---

## 1. Tổng Quan Nghiệp Vụ

### 1.1 Mục tiêu
- **Số hóa 100% đề nghị chi tiêu**: Loại bỏ giấy tờ, phiếu in tay, theo dõi tập trung mọi khoản tiền ra của doanh nghiệp rượu vang LyCellar.
- **Lưu trữ chứng từ scan bảo mật**: Tích hợp Cloudflare R2 (10 GB lưu trữ miễn phí vĩnh viễn, 0 đồng băng thông tải về) với cơ chế Pre-signed URL có thời hạn (15-30 phút), không lộ link ra ngoài.
- **Trình xem Split-View trực tiếp**: Người duyệt có thể vừa xem hóa đơn scan phóng to/xoay/xem PDF bên trái, vừa bấm Duyệt hoặc Trả lại bên phải mà không cần tải file về máy.
- **Phê duyệt đa cấp theo hạn mức (Threshold-based)**:
  - Cấp 1 (Trưởng phòng): Xác nhận tính cần thiết và nghiệp vụ chi.
  - Cấp 2 (Kế toán thanh toán / Kế toán trưởng): Kiểm tra tính hợp lệ của hóa đơn GTGT, đối soát công nợ. Khoản chi < 20 triệu có thể duyệt hoàn tất.
  - Cấp 3 (CEO / Ban Giám Đốc): Phê chuẩn các khoản chi ≥ 20 triệu hoặc các khoản chi vượt ngân sách định mức.
- **Khép kín quy trình chi tiền**: Kế toán giải ngân (chuyển khoản/tiền mặt), upload bản scan Ủy nhiệm chi (UNC) và tự động ghi nhận thanh toán/giảm nợ công nợ NCC (`APPayment`).
- **Quản lý Hạng mục & Định mức Ngân sách**: Thiết lập danh mục chi phí phân cấp (gắn mã tài khoản VAS 641, 642, 635, 811...) và phân bổ hạn mức ngân sách chi theo kỳ kèm thanh cảnh báo tiến độ tiêu thụ (Vàng khi chạm 85%, Đỏ khi vượt 100%).

### 1.2 Phân quyền theo vai trò (RBAC)
| Vai trò | Quyền hạn |
|---|---|
| **Nhân viên / Người lập** | Lập phiếu, chọn hạng mục, nhập khoản mục chi tiết, upload chứng từ scan, theo dõi trạng thái phiếu của mình |
| **Trưởng bộ phận (Cấp 1)** | Duyệt/Trả lại/Từ chối các đề nghị thuộc phòng ban mình phụ trách |
| **Kế toán (Cấp 2)** | Soát xét hóa đơn VAT, kiểm tra tài khoản hạch toán, duyệt phiếu < 20M, chuyển CEO phiếu lớn |
| **CEO / CFO (Cấp 3)** | Toàn quyền xem và phê chuẩn tất cả đề nghị thanh toán của toàn công ty |
| **Thủ quỹ / Kế toán thanh toán** | Thực hiện lệnh chi, upload file scan UNC, xác nhận trạng thái `PAID` |

---

## 2. Luồng Trạng Thái (Status Flow)

```text
       [DRAFT] (Bản nháp)
          │
          ▼
     [SUBMITTED] ──(Trưởng phòng duyệt)──► [REVIEWING_L1]
          │                                      │
          │                               (Kế toán duyệt)
          │                                      │
          │                   ┌──────────────────┴──────────────────┐
          │                   ▼                                     ▼
          │         [REVIEWING_L2] (CEO duyệt)                  [APPROVED]
          │                   │                                     │
          │                   └──────────────────┬──────────────────┘
          │                                      ▼
          │                             [APPROVED] (Chờ chi)
          │                                      │
          │                              (Kế toán chi tiền & upload UNC)
          │                                      ▼
          │                                   [PAID] (Hoàn tất)
          │
          └───► [RETURNED / DRAFT] (Trả lại để sửa)
          └───► [REJECTED] (Từ chối)
```

| Trạng thái | Ý nghĩa | Hành động tiếp theo |
|---|---|---|
| `DRAFT` | Phiếu mới tạo hoặc bị trả lại sửa | Người lập hoàn thiện và bấm "Gửi duyệt" |
| `SUBMITTED` | Đã gửi, chờ Trưởng phòng duyệt cấp 1 | TP xem xét sự vụ |
| `REVIEWING_L1` | TP đã duyệt, chờ Kế toán soát xét hóa đơn | Kế toán kiểm tra chứng từ VAT |
| `REVIEWING_L2` | Kế toán đã duyệt, chờ CEO phê chuẩn | CEO quyết định chi |
| `APPROVED` | Đã phê duyệt hoàn tất, chuyển sang hàng đợi chi | Kế toán xuất quỹ hoặc chuyển khoản |
| `PAID` | Đã thanh toán thực tế, đã có số UNC và scan UNC | Hồ sơ lưu trữ hoàn tất |
| `REJECTED` | Bị từ chối duyệt | Dừng quy trình |
| `CANCELLED` | Đã hủy bởi người lập | Đóng phiếu |

---

## 3. Kiến Trúc Dữ Liệu

### 3.1 Bảng dữ liệu chính
1. `payment_requests`: Quản lý thông tin chung phiếu đề nghị, số tiền nguyên tệ & quy đổi VND, thông tin người thụ hưởng, tài khoản ngân hàng, liên kết PO/Hóa đơn NCC/Tờ trình.
2. `payment_request_items`: Chi tiết từng dòng khoản chi, gắn với hạng mục chi phí (`categoryId`), tài khoản hạch toán, số hóa đơn VAT, đơn giá, số lượng, thuế VAT.
3. `payment_request_attachments`: Quản lý chứng từ scan (Hóa đơn GTGT, Biên bản bàn giao, Hợp đồng, Giấy nộp tiền, UNC) lưu trữ trên Cloudflare R2 / Supabase.
4. `payment_approval_logs`: Nhật ký phê duyệt đa cấp (ai duyệt, cấp nào, ngày giờ, nhận xét).
5. `expense_category_masters`: Danh mục hạng mục chi phí động, hỗ trợ phân cấp cây cha - con, nhóm chi phí và tài khoản VAS mặc định.
6. `expense_budgets`: Hạn mức ngân sách phân bổ theo Hạng mục, Phòng ban, Năm, Quý/Tháng và ngưỡng cảnh báo vượt định mức.

---

## 4. Giao Diện Người Dùng (UI/UX)

- **Route:** `/dashboard/payment-requests`
- **Tabs điều hướng:**
  1. `Phiếu Đề Nghị Thanh Toán`: Thẻ tóm tắt chỉ số tài chính, bộ lọc trạng thái & nhóm chi, bảng danh sách đề nghị, nút tạo mới.
  2. `Cấu Hình Hạng Mục Chi Phí`: Bảng cấu hình mã hạng mục, nhóm chi, tài khoản VAS mặc định, modal thêm/sửa/ẩn hạng mục.
  3. `Quản Lý & Theo Dõi Ngân Sách`: Bảng theo dõi tiến độ tiêu thụ ngân sách so với định mức theo năm, thanh tiến độ trực quan (xanh, vàng, đỏ).
- **Split-View Modal:**
  - Cột trái: Trình xem chứng từ scan trực tiếp (PDF đa trang hoặc ảnh có công cụ Phóng to, Thu nhỏ, Xoay ảnh 90°, Mở tab mới).
  - Cột phải: Thông tin thanh toán, bảng kê chi tiết, timeline phê duyệt, các nút Duyệt, Trả lại, Từ chối, Chi tiền.
- **Drawer Lập đề nghị:**
  - Nhập thông tin người nhận, tài khoản ngân hàng, bảng kê chi tiết khoản mục.
  - Dropzone kéo thả tải lên nhiều file scan PDF/JPG/PNG với tự động phân loại nhãn chứng từ.

---

## 5. Biểu Mẫu Tờ Trình & Giấy Đề Nghị Thanh Toán (Printable Form — Mẫu 05-TT)

- **Chuẩn hóa kép:**
  - **Mẫu số 05 - TT**: Ban hành theo Thông tư số 200/2014/TT-BTC và Thông tư 133/2016/TT-BTC của Bộ Tài chính phục vụ lưu trữ kế toán thuế và quyết toán.
  - **Tờ trình phê duyệt thanh toán**: Văn bản hành chính nội bộ kính trình Ban Giám Đốc và Hội đồng tài chính.
- **Tính năng nổi bật của Biểu mẫu in ([PrintablePaymentRequest.tsx](file:///d:/Lyruou/wine-erp/src/app/dashboard/payment-requests/PrintablePaymentRequest.tsx)):**
  - **Đọc số tiền thành chữ tiếng Việt tự động**: Hàm tiện ích `numberToWordsVN` chuyển đổi chính xác tiền tệ VND (ví dụ: *Mười lăm triệu năm trăm nghìn đồng chẵn*).
  - **Chuyển đổi tiêu đề linh hoạt**: Cho phép người dùng chuyển đổi nhanh giữa *"Giấy Đề Nghị Thanh Toán"* và *"Tờ Trình Đề Nghị Phê Duyệt Thanh Toán"*.
  - **Mộc phê duyệt điện tử (E-Approved Stamp)**: Tự động đóng dấu mộc điện tử màu xanh/đỏ cho các cấp duyệt (Trưởng phòng, Kế toán, Giám đốc) kèm ngày giờ và họ tên người duyệt online.
  - **Chế độ in phôi trắng**: Tùy chọn ẩn mộc hoặc in phôi trắng trống dữ liệu phục vụ trình ký tay thủ công bằng bút mực khi cần.
  - **Khung 5 chữ ký hoàn chỉnh**: Người đề nghị, Trưởng bộ phận, Kế toán thanh toán, Kế toán trưởng, Tổng Giám Đốc/Người duyệt chi kèm phần xác nhận của Thủ quỹ ngân hàng khi chi tiền.
  - **Tiện ích in ấn đa điểm**: Nút in trực tiếp từ Header modal chi tiết, nút in nhanh trên từng dòng bảng danh sách, và nút "In Phôi Mẫu Trắng" trên thanh công cụ chính.

