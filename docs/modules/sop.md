# Phân Hệ Quy Trình Vận Hành Tiêu Chuẩn (SOP) & Thư Viện Tài Liệu Nghiệp Vụ

> **Mã phân hệ:** `SOP`  
> **Đường dẫn:** `/dashboard/sop`  
> **Quyền truy cập:** Toàn thể cán bộ nhân viên đã đăng nhập (All Authenticated Users)  
> **Quyền quản trị / Chỉnh sửa:** Admin, Ban Giám Đốc, Trưởng bộ phận  
> **Trạng thái:** Hoàn tất chuẩn hóa (Tích hợp 114 tài liệu Markdown nghiệp vụ, 8 quy trình luồng cốt lõi, 43 biểu mẫu hành chính)

---

## 1. Giới Thiệu Tổng Quan
Phân hệ **Quy Trình Vận Hành Tiêu Chuẩn (SOP)** là trung tâm chuẩn hóa toàn bộ quy trình công tác, hướng dẫn nghiệp vụ và hồ sơ chứng từ của công ty trong hệ thống Wine ERP. Phân hệ được thiết kế theo chuẩn B2B Luxury ERP với độ đặc dữ liệu cao và phân tách rõ ràng 3 phân khu:

1. **Thư viện Sổ tay & Tài liệu Quy trình (.md):**
   - Lưu trữ và phân loại **114 tài liệu Markdown nghiệp vụ** chi tiết được biên soạn từ thực tế hoạt động, bao quát 12 nhóm phân hệ:
     - `01_chien_luoc`: Kế hoạch kinh doanh, quản lý danh mục, chính sách định giá, quản lý rủi ro.
     - `02_nha_cung_cap`: Tìm kiếm NCC, đàm phán, ký kết hợp đồng, đánh giá định kỳ, quản lý mẫu thử.
     - `03_mua_hang`: Dự báo nhu cầu, lập PO, xác nhận đơn hàng, theo dõi tiến độ, Incoterms.
     - `04_nhap_khau_logistics`: Quy trình nhập khẩu, booking cont thường lót thermal liner, thủ tục hải quan, thông quan Cát Lái, kiểm tra ATTP.
     - `05_kho_van`: Nhập kho (Kho Thường Tín, Giang Văn Minh, Showroom), dán tem rượu, bảo quản kho mát 16-18°C, FEFO/FIFO, kiểm kê, xuất kho, hàng lỗi.
     - `06_ban_hang`: Phát triển khách hàng mới, CRM, xử lý đơn hàng bán buôn/bán lẻ, chính sách giá và chiết khấu, ký gửi HoReCa, thiết kế Wine list.
     - `07_phap_ly`: Giấy phép phân phối rượu, tự công bố chất lượng, kiểm nghiệm định kỳ, tem nhãn phụ.
     - `08_tai_chinh`: Kế toán tổng quan, thanh toán quốc tế, công nợ AR/AP, giá vốn Landed Cost/COGS, kiểm soát thuế và tem rượu, chi phí tasting.
     - `09_marketing`: Quản trị thương hiệu, duyệt ngân sách POSM, tổ chức sự kiện Wine Tasting, hội chợ.
     - `10_nhan_su`: Quy trình tuyển dụng và hội nhập nhân sự.
     - `11_cntt`: Vận hành hạ tầng CNTT và hệ thống ERP.
     - `12_van_hanh`: Checklist công việc hàng ngày, chuẩn mực cam kết SLA, quy trình tuần showroom & kho.
   - Hỗ trợ bộ lọc theo 12 nhóm nghiệp vụ, bộ lọc ngôn ngữ (Tiếng Việt / English), tìm kiếm tức thời theo từ khóa và thẻ tag.
   - Tích hợp trình đọc văn bản Markdown chuẩn mực (`MarkdownDocModal.tsx`), có chức năng sao chép, in ấn và tải về tệp nguồn.

2. **Quy Trình Nghiệp Vụ Trọng Yếu (SOPs):**
   - Quản trị 8 luồng quy trình tác nghiệp cốt lõi liên phòng ban với sơ đồ luồng từng bước, phân định trách nhiệm RACI, tiêu chí kiểm soát và liên kết trực tiếp sang các phân hệ ERP tương ứng.
   - Trên mỗi thẻ quy trình có nhãn liên kết và nút đọc trực tiếp sổ tay `.md` tương ứng.

3. **Thư Viện Biểu Mẫu Chứng Từ Hành Chính:**
   - Quản lý 43 file mẫu biểu mẫu Excel (`.xlsx`) và Word (`.docx`) chuẩn để nhân viên tải về điền số liệu.
   - Cho phép Admin kéo thả tải lên hoặc thay thế biểu mẫu mới trực tiếp trên giao diện web.

---

## 2. Danh Sách 8 Quy Trình Trọng Yếu Nạp Sẵn

| Mã SOP | Tên Quy Trình | Phòng Ban | Thời Lượng / SLA | Tài Liệu & Biểu Mẫu Đính Kèm | Màn Hình Liên Quan |
|---|---|---|---|---|---|
| `SOP 6.1` | Phát triển Khách hàng Mới (Onboarding) | Phòng Kinh Doanh | 24h duyệt cơ chế • 2 ngày HĐMB | Form 8.8-A, Form 6.1-B, Form 6.1-A, SOP_Sales_Field_Visit_Checkin.md | `/dashboard/customers`, `/dashboard/proposals` |
| `SOP 6.3` | Xử lý Đơn hàng Bán Lẻ & Bán Buôn (SO) | Phòng Kinh Doanh | 15 - 30 phút | Form 6.3-A, Form 5.6-A | `/dashboard/sales`, `/dashboard/warehouse` |
| `SOP 6.4` | Chính sách Giá, Chiết khấu & Check Margin | Phòng Kinh Doanh | 30 phút - 4 giờ | Form 6.4-B, Form 6.4-A, Form 6.4-C, Form 6.4-D | `/dashboard/quotations`, `/dashboard/margin` |
| `SOP 6.8` | Quản lý Hàng ký gửi HoReCa & Kiểm toán vỏ chai | Kinh Doanh & Kho | Kiểm kê ngày 25-30 hàng tháng | Form 5.4-A, Form 5.5-B | `/dashboard/consignment`, `/dashboard/sales` |
| `SOP 8.2` | Quản lý Công nợ Phải thu (AR) & Thu hồi nợ | Tài Chính - Kế Toán | Báo cáo ngày • Đối soát ngày 01-05 | Form 8.2-A, Form 8.2-B, Form 8.2-C | `/dashboard/finance`, `/dashboard/reconciliation` |
| `SOP 8.4` | Tính Giá vốn Thực tế (Landed Cost & COGS) | Tài Chính - Kế Toán | 48h sau khi thông quan | Form 4.5-A, Form 8.4-A | `/dashboard/costing`, `/dashboard/procurement` |
| `SOP 3.1` | Dự báo Nhu cầu & Mua hàng Quốc tế (PO) | Mua Hàng & XNK | 4 - 8 tuần (Lead time 60 ngày) | Form 3.1-A, Form 3.1-B, Form 3.2-A, Form 3.4-A, quy_trinh_nhap_khau_mau.md | `/dashboard/procurement`, `/dashboard/shipments` |
| `SOP 5.1` | Kiểm nhận Nhập kho, Dán tem & Kho mát | Kho Vận | 2 - 4 giờ / Lô hàng | Form 5.1-A, Form 5.2-A, Form 5.3-A, Form 5.7-A | `/dashboard/warehouse`, `/dashboard/stamps` |

---

## 3. Kiến Trúc Kỹ Thuật & Tệp Mã Nguồn

| Đường dẫn tệp | Chức năng |
|---|---|
| `wine-erp/public/docs/processes/` | Thư mục lưu trữ 114 file tài liệu quy trình Markdown phân theo 12 nhóm |
| `wine-erp/public/forms/` | Thư mục lưu trữ 43 file biểu mẫu chuẩn định dạng `.xlsx`, `.docx` |
| `wine-erp/src/data/sops-store.json` | JSON store lưu trữ 8 quy trình tác nghiệp chuẩn có thể cập nhật qua Server Actions |
| `wine-erp/src/app/dashboard/sop/actions.ts` | Server Actions: `getSopsAction`, `saveSopAction`, `deleteSopAction`, `getMarkdownDocsAction`, `getMarkdownContentAction`, `getOfficialFormsAction`, `uploadFormAction` |
| `wine-erp/src/app/dashboard/sop/page.tsx` | Server Component nạp song song SSR (SOPs, Forms, Markdown Docs) |
| `wine-erp/src/app/dashboard/sop/loading.tsx` | Skeleton loading chống giật layout |
| `wine-erp/src/app/dashboard/sop/SopCatalogClient.tsx` | Client Component với giao diện 3 tab (Sổ tay .md, Quy trình SOPs, Biểu mẫu), lọc 12 nhóm, tìm kiếm tức thời |
| `wine-erp/src/app/dashboard/sop/SopDetailModal.tsx` | Modal xem chi tiết trình tự thực hiện, ma trận RACI, tiêu chuẩn kiểm soát và nút đọc sổ tay `.md` đính kèm |
| `wine-erp/src/app/dashboard/sop/MarkdownDocModal.tsx` | Modal đọc văn bản Markdown với thanh công cụ sao chép, in ấn và định dạng Typography chuẩn |
| `wine-erp/src/components/ui/MarkdownViewer.tsx` | Component render nội dung Markdown bằng `marked` chuẩn B2B Luxury ERP |
