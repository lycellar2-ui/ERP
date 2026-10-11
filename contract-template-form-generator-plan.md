# Kế Hoạch Triển Khai: Tạo Hợp Đồng Dựa Theo Biểu Mẫu Word (.docx) & Quản Lý Kho Mẫu Biểu

## 1. Bối cảnh & Mục tiêu
- **Phân hệ**: Hợp đồng & Pháp lý (`wine-erp/src/app/dashboard/contracts`).
- **Nhu cầu nghiệp vụ**:
  - Hợp đồng kinh doanh rượu có nhiều loại đặc thù:
    1. **Hợp đồng nguyên tắc (Master/Framework Agreement)**: Thiết lập quan hệ đại lý/bán buôn, hạn mức công nợ, thời hạn thanh toán chung.
    2. **Hợp đồng phụ lục ký gửi (Consignment Addendum)**: Ký gửi rượu tại nhà hàng, khách sạn, đại lý, quy định hoa hồng, bảo quản, chu kỳ đối soát.
    3. **Hợp đồng mua bán một lần (Spot Order Contract)**: Mua bán theo từng chuyến hàng cụ thể, có bảng danh mục sản phẩm chi tiết (Tên rượu, Vintage, Xuất xứ, Số lượng, Đơn giá, Thành tiền).
  - **Lưu trữ và quản lý biểu mẫu (Template Storage)**: Doanh nghiệp cần lưu trữ các file mẫu Word (`.docx`), phân loại theo từng nghiệp vụ, cho phép tải mẫu chuẩn về máy, upload biểu mẫu mới của công ty lên hệ thống.
  - **Sinh hợp đồng từ form**: Nhân viên chọn mẫu biểu $\rightarrow$ Điền thông tin vào form (tự động gợi ý dữ liệu Đối tác từ hệ thống) $\rightarrow$ Merge tự động các trường dữ liệu vào file `.docx` $\rightarrow$ Xuất file Word tải về máy để chỉnh sửa/in ấn $\rightarrow$ Tự động lưu bản ghi hợp đồng vào ERP đính kèm file vừa sinh.

---

## 2. Kiến trúc Kỹ thuật & Luồng Dữ Liệu

### A. Thư viện Xử lý Merge DOCX
- Cài đặt `docxtemplater` và `pizzip` (chạy thuần túy trên môi trường Node.js Server Action / API Route, không cần LibreOffice hay binary ngoài).
- Hỗ trợ đầy đủ:
  - Thay thế biến đơn: `{so_hop_dong}`, `{ngay_ky}`, `{ten_khach_hang}`, `{mst}`, `{dia_chi}`, `{dai_dien}`, `{chuc_vu}`, `{tong_tien}`, `{tong_tien_bang_chu}`, `{han_muc_cong_no}`, `{thoi_han_thanh_toan}`...
  - Lặp dòng bảng sản phẩm rượu chi tiết: `{#san_pham}{stt} | {ten_ruou} | {nien_vu} | {xuat_xu} | {dvt} | {so_luong} | {don_gia} | {thanh_tien}{/san_pham}`.
  - Điều kiện ẩn/hiện điều khoản: `{#co_chiet_khau}...{/co_chiet_khau}`.

### B. Cấu trúc Kho Biểu Mẫu (Contract Templates Management)
- Hệ thống xây dựng module quản lý biểu mẫu hợp đồng (`contract-template-service.ts`):
  - Định nghĩa sẵn 3 mẫu biểu chuẩn ngành rượu (với file `.docx` mẫu chuẩn sẵn trong kho tài nguyên tĩnh hoặc storage):
    1. **Mẫu 01: Hợp đồng nguyên tắc mua bán rượu** (`HD_NGUYEN_TAC` - B2B/Đại lý phân phối).
    2. **Mẫu 02: Phụ lục hợp đồng ký gửi rượu** (`HD_KY_GUI` - Ký gửi nhà hàng, showroom, đại lý).
    3. **Mẫu 03: Hợp đồng mua bán rượu từng lần** (`HD_MOT_LAN` - Đơn hàng cụ thể có bảng chi tiết sản phẩm).
  - Hỗ trợ lưu trữ file mẫu tùy chỉnh của công ty lên Cloud Storage (Supabase Storage bucket `contracts` / R2), ghi nhận phiên bản, mô tả, danh sách placeholder tags.
  - Chức năng:
    - Xem danh sách mẫu biểu & danh sách thẻ biến (placeholders) có thể dùng trong mẫu Word.
    - Tải file `.docx` mẫu trắng về để phòng pháp chế chỉnh sửa bố cục/câu chữ.
    - Upload file `.docx` mẫu mới/cập nhật vào hệ thống.

### C. Engine Sinh Văn Bản (`src/lib/docx-generator.ts`)
- Đọc template buffer từ local asset hoặc Cloud Storage.
- Tiện ích đọc số tiền thành chữ tiếng Việt chuẩn kế toán (`vietnameseCurrencyWords` - hỗ trợ cả VNĐ và USD).
- Format ngày tháng định dạng văn bản pháp lý: *"Hà Nội, ngày ... tháng ... năm ..."*.
- Merge dữ liệu an toàn với `docxtemplater`, xử lý lỗi tag thiếu, sinh file đầu ra dạng buffer.
- Upload file đã sinh lên Storage bucket `contracts/generated/` và liên kết với `ContractDocument`.

### D. Server Actions (`src/app/dashboard/contracts/template-actions.ts`)
1. `getContractTemplatesAction()`: Lấy danh sách các mẫu biểu trong kho, bao gồm mẫu mặc định và mẫu tùy chỉnh đã upload.
2. `getTemplateFieldsAction(templateCode)`: Trả về danh mục các trường nhập liệu tương ứng với mẫu được chọn (thông tin chung, thông tin đối tác, điều khoản tài chính, bảng sản phẩm).
3. `generateContractFromTemplateAction(data)`:
   - Validate dữ liệu đầu vào bằng Zod schema.
   - Nạp template `.docx` tương ứng.
   - Merge dữ liệu form vào template $\rightarrow$ tạo file `.docx` hoàn chỉnh.
   - Lưu bản ghi hợp đồng vào bảng `Contract` (loại hợp đồng, đối tác, giá trị, thời hạn, ghi chú mẫu biểu).
   - Upload file kết quả vào Storage $\rightarrow$ tạo bản ghi `ContractDocument` liên kết với hợp đồng vừa tạo.
   - Trả về Base64 file Word để client tải trực tiếp về máy, kèm thông tin hợp đồng vừa tạo thành công.
4. `uploadCustomTemplateAction(formData)`: Cho phép upload file `.docx` mẫu biểu mới vào hệ thống.
5. `downloadSampleTemplateAction(templateCode)`: Cho phép tải file mẫu biểu nguyên bản về máy.

### E. Giao diện Người dùng (UI/UX)
1. **Nút "Tạo HĐ từ biểu mẫu" (Create from Template)** tại Toolbar trang Hợp đồng:
   - Mở Drawer/Modal Wizard trực quan 3 bước:
     - **Bước 1: Chọn mẫu biểu**: Card lựa chọn 3 loại mẫu chính (HĐ Nguyên tắc, Phụ lục Ký gửi, HĐ Một lần) kèm mô tả nghiệp vụ.
     - **Bước 2: Điền thông tin theo mẫu**:
       - *Đối tác*: Chọn nhanh Khách hàng hoặc Nhà cung cấp $\rightarrow$ Hệ thống tự động điền Tên công ty, MST, Địa chỉ, Người đại diện, Chức vụ, SĐT.
       - *Thông tin HĐ*: Số hợp đồng (gợi ý tự động), Ngày ký, Ngày hiệu lực, Ngày hết hạn.
       - *Điều khoản đặc thù theo loại*: Hạn mức công nợ, Số ngày thanh toán, Tỷ lệ hoa hồng ký gửi, Địa điểm kho ký gửi...
       - *Danh mục rượu (với HĐ một lần / Ký gửi)*: Bảng thêm/xóa sản phẩm rượu từ danh mục sản phẩm của hệ thống (chọn rượu $\rightarrow$ tự điền niên vụ, xuất xứ, đơn giá $\rightarrow$ tính thành tiền và tổng giá trị tự động).
     - **Bước 3: Xem lại & Xuất file**:
       - Xem tóm tắt thông tin hợp đồng trước khi sinh file.
       - Bấm **"Sinh & Tải file Word (.docx)"**: Tải ngay file Word về máy và tự động thêm vào danh sách Hợp đồng trên hệ thống.
2. **Tab "Kho Biểu Mẫu" (Contract Templates Tab)** trong trang Hợp đồng:
   - Hiển thị danh mục các biểu mẫu đang có trong hệ thống.
   - Nút **[Tải Mẫu .docx]**: Tải file mẫu về máy để xem trước hoặc sửa đổi bằng Microsoft Word.
   - Nút **[Tải Lên Mẫu Mới]**: Upload file `.docx` mới thay thế hoặc bổ sung.
   - Bảng hướng dẫn tra cứu các biến (Placeholder Tags Reference) để người dùng biết cách chèn `{ten_khach_hang}`, `{so_hop_dong}`, `{#san_pham}...{/san_pham}` vào file Word của riêng mình.

---

## 3. Các Bước Triển Khai Chi Tiết

- [ ] **Giai đoạn 1: Cài đặt thư viện & Xây dựng DOCX Generator Engine**
  - Cài đặt `docxtemplater` và `pizzip`.
  - Tạo bộ tạo file mẫu `.docx` tiêu chuẩn cho 3 loại hợp đồng (`HD_NGUYEN_TAC`, `HD_KY_GUI`, `HD_MOT_LAN`).
  - Viết module tiện ích đọc số tiền thành chữ (`vietnamese-words.ts`).
  - Xây dựng core generator `src/lib/docx-generator.ts` xử lý merge dữ liệu form vào file `.docx`.

- [ ] **Giai đoạn 2: Xây dựng Backend Server Actions**
  - Tạo `src/app/dashboard/contracts/template-actions.ts`.
  - Xử lý lưu trữ mẫu biểu, merge dữ liệu, lưu hợp đồng vào database (`Contract` + `ContractDocument`).
  - Hỗ trợ tải mẫu chuẩn và upload mẫu tùy chỉnh.

- [ ] **Giai đoạn 3: Xây dựng Giao diện Người dùng (UI Components)**
  - Xây dựng Component `CreateFromTemplateDrawer.tsx` (Wizard 3 bước tạo hợp đồng từ mẫu).
  - Xây dựng Tab `ContractTemplatesTab.tsx` (Quản lý kho biểu mẫu, tải mẫu, tra cứu biến placeholder).
  - Tích hợp vào `ContractsClient.tsx` (thêm tab Biểu mẫu và nút mở Drawer Tạo từ mẫu).

- [ ] **Giai đoạn 4: Kiểm thử, Tối ưu hóa & Đồng bộ Tài liệu (Docs Sync)**
  - Kiểm tra tạo hợp đồng thực tế cho cả 3 loại: HĐ Nguyên tắc, Phụ lục Ký gửi, HĐ Một lần.
  - Kiểm tra tải file Word sinh ra, kiểm tra định dạng hiển thị trong Word.
  - Kiểm tra lưu trữ vào hồ sơ hợp đồng ERP.
  - Cập nhật tài liệu: `docs/modules/contracts.md`, `docs/README.md`.
