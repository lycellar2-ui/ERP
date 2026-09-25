# Sales Field Visit (SFV) — Wine ERP Module Spec

> **Route:** `/dashboard/sales/visits`
> **Tiêu đề trang & Menu:** Quản Lý Check-in Thị Trường
> **Mã module:** SFV
> **Cập nhật ngày:** 2026-09-23 (Chuẩn hóa copy doanh nghiệp, loại bỏ AI slop, tối ưu SSR pre-fetching và tốc độ tải trang tức thì <1s)

---

## Mô Tả

Module **Quản Lý Check-in Thị Trường** (Sales Field Operations) được kiến trúc phân định rạch ròi theo 2 vai trò người dùng:

1. **Dành cho Nhân viên Sales (Tài khoản nào biết tài khoản đó):**
   - Không có dropdown chọn nhân viên khác, bảo mật và cô lập dữ liệu tuyệt đối.
   - Quy trình khép kín 4 tab: Check-in hôm nay, Kế hoạch tuần, Tổng kết tuần, Lịch sử ảnh.
   - Giao diện di động tối ưu hoá 1 chạm với thanh điều hướng cố định đáy 4 nút, nút gọi điện, nút mở Google Maps chỉ đường.
   - Tối ưu GPS: Mở trang chỉ đọc toạ độ nhẹ từ cache mạng di động không gây nghẽn giao diện; chỉ kích hoạt GPS chính xác cao khi bấm chụp ảnh check-in thực tế.
2. **Dành cho Quản lý / CEO / Ban Giám Đốc (Không phải check-in, xem Báo Cáo Chung):**
   - Quản lý không đi thị trường nên không có các tab check-in thực địa, không kích hoạt phần cứng GPS.
   - Giao diện mở trực tiếp **Bảng Giám Sát & Báo Cáo Chung (Executive Board)**:
     - 5 Thẻ KPI đo lường toàn đội ngũ: Số nhân sự (chỉ tính nhân sự có vai trò Sales Rep), Tổng kế hoạch, Đã check-in thực tế, Tỷ lệ hoàn thành %, Số báo cáo chờ duyệt.
     - Bộ điều hướng chọn tuần và nút làm mới tức thời.
     - Bảng ma trận đối soát Kế hoạch vs Thực tế từng nhân viên: Chỉ lọc và hiển thị các tài khoản Sale thực địa (Sales Rep), loại trừ các bộ phận văn phòng khác (Kế toán, Thủ kho, Admin...).
     - Modal thẩm định chuyên sâu: Xem ảnh check-in thực tế kèm GPS/watermark to rõ, kiểm tra kế hoạch tuần và phê duyệt đánh giá KPI.
     - Tối ưu tải trang: Pre-fetch dữ liệu tổng quan đội ngũ ngay từ server SSR, loại bỏ spinner và duplicate request trên client.

## Tính Năng Chính

### 1. Phân Tách Vai Trò Người Dùng Tuyệt Đối
- **Tài khoản Sale ("Tài khoản nào biết tài khoản đó"):**
  - Cố định `selectedSalespersonId = currentUserId`, loại bỏ hoàn toàn ô chọn nhân viên trên giao diện.
  - Server Actions backend (`actions.ts`) ép buộc `where.salespersonId = user.id` nếu không phải Manager.
  - Hiển thị 4 tab tác nghiệp: Check-in hôm nay, Lịch tuần, Tổng kết tuần, Hình ảnh.
- **Tài khoản Quản lý / CEO / BGĐ (`isManager === true`):**
  - Không phải check-in, ẩn hoàn toàn các tab check-in thực địa và thanh bottom bar mobile.
  - Chuyển thẳng vào màn hình **Báo Cáo Giám Sát Toàn Đội** với đầy đủ số liệu KPI tổng hợp và bảng ma trận nhân viên.
- **Chuẩn hoá tiêu đề hiển thị:**
  - Tiêu đề thanh điều hướng Header ERP: `Quản Lý Check-in Thị Trường` (sửa lỗi hiển thị nhầm "Đơn Bán Hàng").
  - Mục menu Sidebar: `Quản Lý Check-in Thị Trường`.

### 6. Khả Năng Vận Hành Ngoại Tuyến (Offline Drafts) & Cấp Quyền GPS
- **Offline Draft Queue (Chống mất sóng 4G ở hầm rượu):**
  - Khi sale tác nghiệp ở hầm rượu, tầng hầm nhà hàng bị mất kết nối Internet, hệ thống tự động bắt lỗi và lưu bản ghi check-in cùng ảnh chụp vào `localStorage` (`SALES_VISITS_OFFLINE_DRAFTS_V1`).
  - Thanh thông báo trạng thái ngoại tuyến hiển thị rõ số lượt check-in đang chờ đồng bộ kèm nút "Đồng bộ ngay".
  - Tự động bắt sự kiện `window.addEventListener('online')` để đẩy các bản ghi offline lên máy chủ ngay khi thiết bị có sóng 4G/Wifi trở lại mà không cần nhập lại.
- **Hướng Dẫn Cấp Quyền GPS 1-Chạm:**
  - Modal hướng dẫn trực quan chia tab riêng cho **iOS Safari** (Cài đặt -> Safari -> Vị trí -> Cho phép) và **Android Chrome** (Biểu tượng ổ khoá/Cài đặt trang web -> Quyền vị trí -> Cho phép).
  - Nút bấm "Xem hướng dẫn bật GPS" tích hợp trực tiếp trên thanh trạng thái định vị và ngay trên kính ngắm camera khi phát hiện thiết bị chưa cấp toạ độ.
- **Bảo Mật Server Actions (Auth Guard):**
  - Toàn bộ 10 Server Actions trong `actions.ts` được bảo vệ bằng `requireAuth()`.
  - Nghiêm cấm nhận `salespersonId` từ client mà không đối chiếu quyền hạn; chỉ cho phép người dùng thao tác trên dữ liệu của chính mình (hoặc quyền Quản lý đối với các tác vụ duyệt kế hoạch/xem tổng quan).

### 7. Giao Diện Ứng Dụng Di Động Chuyên Nghiệp (Mobile-First Native App Experience)
- **Fixed Bottom Navigation Bar (Thanh điều hướng cố định đáy):**
  - Cố định ở mép dưới điện thoại (`fixed bottom-0 z-40`), kính mờ `backdrop-blur-lg`, phân cách nhẹ chuẩn app di động (Grab/Shopee/Zalo).
  - 4 Tab tiện dụng: 📍 Hôm nay (kèm số điểm cần đi), 📅 Lịch tuần (kèm tổng điểm lên lịch), 📊 Tổng kết, 📸 Hình ảnh.
  - Tự động ẩn thanh tab trên đầu khi xem trên mobile (`md:hidden`), bổ sung khoảng đệm an toàn `pb-28 md:pb-16` chống che khuất nội dung.
- **Mobile Bottom Sheets (Ngăn kéo vuốt từ đáy màn hình):**
  - Chuyển đổi toàn bộ 3 modal tác vụ thực địa (`Check-in đột xuất`, `Thêm điểm vào lịch`, `Tạo nhanh khách hàng tiềm năng`) từ hộp thoại ở giữa màn hình thành **Native Bottom Sheet** trên di động (`rounded-t-3xl sm:rounded-2xl`).
  - Tích hợp thanh gờ kéo trực quan (`pull indicator drag bar`), hiệu ứng trượt từ đáy mượt mà (`slide-in-from-bottom-6`) và chạm vùng nền backdrop để đóng nhanh.
- **Floating Action Button (FAB) Check-in 1-Chạm:**
  - Nút bấm tròn nổi bật cố định góc dưới phải (`fixed bottom-20 right-4 md:hidden z-30`) trên tab Hôm nay. Cho phép nhân viên bấm check-in đột xuất ngay lập tức từ bất kỳ vị trí cuộn trang nào mà không cần kéo ngược lên đầu.
- **Chống Auto-Zoom trên iOS Safari:**
  - Cỡ chữ toàn bộ các ô nhập liệu `<input>`, `<select>`, `<textarea>` và Searchable Customer Combobox trên mobile được thiết lập tối thiểu 16px (`text-base sm:text-xs`) loại bỏ triệt để lỗi Safari tự động phóng to trang web làm vỡ khung nhìn khi gõ phím.
- **Thẻ Khách Hàng Thực Địa Hôm Nay (Touch-Friendly Native Cards):**
  - Tích hợp nút 1-chạm **[🗺️ Chỉ đường Maps]** mở trực tiếp Google Maps App dẫn đường tới quán.
  - Tích hợp nút 1-chạm **[📞 Gọi điện]** (`tel:`) liên hệ nhanh với chủ quán / phụ trách mua hàng.
  - Nút bấm chính **`[📸 CHECK-IN & CHỤP 1 ẢNH]`** kích thước lớn tối thiểu 48px, hiệu ứng active scale mượt mà, tối ưu bấm bằng 1 ngón tay cái khi đứng trước điểm bán.
- **Thanh Chọn Ngày Ngang (Horizontal Date Strip T2 ➔ CN):**
  - Màn hình Kế hoạch tuần trên di động hiển thị thanh cuộn ngang 7 ngày với tên thứ, ngày tháng và số điểm đã lên lịch.
  - Hỗ trợ cuộn hít từng ngày **`snap-x snap-mandatory`** kết hợp hiệu ứng nén xúc giác `active:scale-95`.
  - Chạm chọn ngày nào hiển thị ngay danh sách điểm đến của ngày đó bên dưới kèm nút **[+ Thêm Điểm]**, không phải cuộn trang dọc qua 7 khối bảng dài.

### 8. Bảng Đối Soát Tuần Hợp Nhất Theo Từng Khách Hàng (Unified Review Audit)
- **Hợp nhất Kế hoạch & Thực tế trên cùng 1 khách hàng:**
  - Loại bỏ hoàn toàn mô hình tách 2 cột rời rạc ("Kế hoạch dự kiến" và "Thực tế thực hiện") gây khó khăn khi đối soát chéo.
  - Mỗi khách hàng trong ngày được thể hiện bằng **1 thẻ duy nhất**, bao gồm:
    - **Huy hiệu phân loại rõ ràng:** `📋 THEO KẾ HOẠCH` (điểm có lên lịch trước) vs `⚡ ĐỘT XUẤT` (điểm phát sinh thực địa ngoài kế hoạch).
    - **Trạng thái thực hiện:** `✓ Đã hoàn thành` vs `Chưa đi / Bỏ lỡ`.
    - **Đối soát song song bên trong thẻ:**
      - **🎯 Kế hoạch:** Mục tiêu công việc đã đặt ra ban đầu (hoặc ghi chú "Không có trong kế hoạch ban đầu").
      - **📍 Thực tế:** Giờ check-in, ghi chú kết quả thị trường và nút xem ảnh camera phân giải cao.

### 9. Thư Viện Hình Ảnh Check-in Trực Quan (Visual Photo Gallery Grid)
- **Chuyển đổi giao diện Tab Hình ảnh:**
  - Thay thế bảng table thô cũ bằng **Lưới thẻ ảnh trực quan (Photo Card Grid)** tỉ lệ 4:3 sắc nét, bo góc chuẩn mực và hiệu ứng hover zoom.
  - **Huy hiệu thông tin trên ảnh:**
    - Huy hiệu thời gian và ngày chụp rõ ràng trên góc ảnh.
    - Phân loại `⚡ ĐỘT XUẤT` / `📋 KẾ HOẠCH`.
    - Dải gradient đen mờ bên dưới ảnh hiển thị thông tin địa chỉ/toạ độ GPS thực tế.
  - **Thông tin chi tiết thẻ ảnh:**
    - Tên khách hàng, mã khách hàng `[KH...]` và kênh bán hàng.
    - Ghi chú kết quả thực địa.
    - Nút mở Google Maps dẫn đường tới toạ độ thực tế và nút xem ảnh toàn màn hình với bộ giải mã HD lazy loading.
  - **Thanh công cụ lọc & Chuyển đổi linh hoạt:**
    - Tìm kiếm nhanh theo tên khách, mã khách hoặc nội dung ghi chú.
    - Bộ lọc nhanh ngày: Tất cả / Hôm nay hoặc chọn ngày bất kỳ.
    - Lọc trạng thái check-in (Đang diễn ra / Hoàn tất).
    - Nút chuyển đổi nhanh 2 chế độ hiển thị: **Lưới ảnh (Visual Grid)** và **Bảng kê (Audit Table)**.

### 10. Chuyển Đổi Ngôn Ngữ Song Ngữ (Bilingual English / Tiếng Việt)
- **Tích Hợp Nút Chuyển Ngôn Ngữ Tại Header:**
  - Nút chuyển đổi nhanh **`[ VI | EN ]`** được tích hợp ngay trên thanh Header chính của hệ thống (`Header.tsx`), tự động hiển thị khi người dùng truy cập trang `/dashboard/sales/visits`.
  - Đồng bộ hoá 2 chiều tức thì giữa Header và giao diện trang thông qua Custom Event `sales_visits_locale_change` và lưu trữ `localStorage` (`sales_visits_locale`), không gây lag giật hay phải tải lại trang.
  - Tiêu đề trên Header tự động chuyển đổi giữa `Quản Lý Check-in Thị Trường` (VI) và `Field Check-in Management` (EN).
- **Dịch Toàn Bộ Nhãn Giao Diện & Thao Tác (UI Labels):**
  - **4 Tab Tác Nghiệp & Mobile Bottom Bar:** Check-in Hôm Nay / Today's Check-in, Kế Hoạch Tuần / Weekly Plan, Tổng Kết Tuần / Weekly Summary, Hình Ảnh / Photos.
  - **Bảng Giám Sát Quản Lý (Executive Matrix):** 5 Thẻ KPI, tên cột bảng đối soát (Nhân sự, Kế hoạch, Thực tế, Tỷ lệ, Báo cáo, Thao tác), modal thẩm định báo cáo và xếp loại KPI.
  - **7 Loại Hoạt Động Định Nghĩa Sẵn (Activity Presets):** Chăm sóc định kỳ, Thử rượu & giới thiệu mẫu mới, Kiểm tra tồn kho & POS, Thu hồi công nợ, Ký kết hợp đồng, Xử lý khiếu nại, Mục đích khác.
  - **Live Camera Viewfinder:** Toàn bộ thông báo lỗi quyền camera, watermark thời gian/toạ độ GPS, các nút Chụp ảnh/Chụp lại/Xác nhận và kính ngắm chụp.
  - **Modal Hướng Dẫn GPS:** Đầy đủ hướng dẫn chi tiết cho cả iOS Safari và Android Chrome bằng cả 2 ngôn ngữ.
  - **Bộ Lọc Lịch Sử & Thư Viện Ảnh:** Các bộ lọc ngày, trạng thái, chuyển đổi Lưới ảnh/Bảng kê, các huy hiệu Kế hoạch / Đột xuất.
- **Bảo Toàn Toàn Bộ Dữ Liệu Nhập Liệu (Zero Mutation on User Data):**
  - Giữ nguyên vẹn 100% các dữ liệu do người dùng nhập: Tên khách hàng, mã khách hàng, số điện thoại, địa chỉ, ghi chú thực địa của Sale, nội dung báo cáo tự đánh giá, và nhận xét thẩm định của Ban Quản lý.

### 11. Báo Cáo Nhanh Thực Địa & Bảng Tin Trực Tiếp Của Quản Lý (Quick Field Report & Today's Live Feed)
- **Dành cho Nhân viên Sales (Tác Nghiệp Nhanh):**
  - **Quy trình 2 nhịp mượt mà:** Check-in chụp 1 ảnh camera nhanh trước cửa hàng để ghi nhận toạ độ và thời gian thực. Sau đó, tại thẻ khách hàng trong mục "Ảnh & Lượt Check-in Thực Tế Hôm Nay" hoặc ngay tại điểm kế hoạch đã hoàn thành, xuất hiện nút **`[📝 Ghi Báo Cáo Nhanh / Kết Quả]`** (hoặc `[✏️ Sửa Báo Cáo Nhanh]`).
  - **Hộp thoại Báo Cáo Nhanh (`QuickReportModal.tsx`):**
    - 7 Thẻ gợi ý 1-chạm (Quick Tag Chips) thực chiến đặc thù ngành rượu: *Khách quan tâm vang Ý, Đã gửi mẫu thử tasting, Quầy hết tồn cần lên đơn, Thu công nợ/đối soát, Đàm phán hợp đồng/menu, Khách phản ánh giá, Chăm sóc định kỳ tốt*.
    - Chạm thẻ nào sẽ tự động điền hoặc chèn thêm gạch đầu dòng vào nội dung báo cáo mà không cần gõ phím nhiều trên điện thoại.
    - Khung nhập liệu chi tiết kèm bộ đếm ký tự trực quan.
    - Tích hợp Server Action `updateSalesVisitReportAction` cập nhật ngay lập tức trường `SalesVisit.notes`, đồng bộ sang `SalesVisitSchedule.resultNotes`.
- **Dành cho Quản lý / Ban Giám Đốc (Giám Sát Trực Tiếp Trong Ngày):**
  - **Bảng Tin Báo Cáo Thực Địa Hôm Nay (`TodayLiveFeed.tsx`):**
    - Đặt nổi bật ngay trên màn hình Quản lý (nằm giữa cụm 5 Thẻ KPI và Bảng ma trận nhân viên).
    - Huy hiệu `LIVE` nhấp nháy đỏ thời gian thực thể hiện các lượt check-in phát sinh trong ngày hôm nay.
    - 3 Thẻ thống kê nhanh: Tổng lượt check-in hôm nay, Đã có báo cáo thực địa, Đang chờ báo cáo.
    - Bộ lọc đa chiều: Dropdown chọn lọc theo từng nhân viên Sales, 3 nút lọc nhanh (Tất cả / Đã có báo cáo / Chưa có báo cáo), và thanh tìm kiếm toàn văn theo tên khách, mã khách, tên nhân viên hoặc từ khoá trong nội dung báo cáo.
    - Danh sách thẻ báo cáo chi tiết:
      - Tên khách hàng, mã khách, phân loại kênh (HORECA/Wholesale/Retail).
      - Tên nhân viên phụ trách viếng thăm.
      - Ảnh chụp thực địa kèm chức năng bấm xem ảnh phóng to chi tiết.
      - Địa chỉ GPS và link mở Google Maps xác minh vị trí.
      - Khối trích dẫn nội dung báo cáo nhanh nổi bật với tông màu sáng dịu mắt.
      - Nút hỗ trợ Quản lý chỉnh sửa hoặc bổ sung ý kiến trực tiếp vào báo cáo.
  - **Tích hợp trong Modal Thẩm Định Chi Tiết:**
    - Trong tab "Ảnh check-in" của từng nhân viên khi Quản lý bấm "Thẩm định", mỗi thẻ lượt đi đều có khối Báo Cáo Nhanh kèm nút `[✏️ Sửa báo cáo]` / `[+ Ghi báo cáo]`.

### 12. Cơ Chế Khóa Dữ Liệu Quá Khứ & Quyền Sửa Báo Cáo Trong Tuần (Past Day Data Protection & Active Week Report Editing)
- **Mục đích:** Đảm bảo tính trung thực của dữ liệu thị trường (ngăn Sales xóa dấu vết kế hoạch quá khứ hoặc xóa sạch báo cáo), đồng thời **vẫn tạo điều kiện cho Sales chủ động cập nhật, bổ sung báo cáo thực địa cho các ngày trong tuần** trước khi nộp tổng kết tuần.
- **Bảo Vệ Kế Hoạch Tuần (Weekly Plan Protection):**
  - **Giao diện Client (Mobile & Desktop):**
    - Các ngày trong tuần đã trôi qua (`dateStr < todayStr`), hệ thống tự động ẩn nút xóa `[X]` và nút `[+ Thêm Điểm]`, thay thế bằng huy hiệu `🔒 Đã khóa (Ngày đã qua)`.
    - Hàm xóa điểm `handleRemovePlanVisit` chặn mọi thao tác xóa điểm thuộc ngày đã qua và hiển thị cảnh báo toast.
  - **Server Action `saveWeeklyPlanAction` (Bảo mật 2 lớp):**
    - Kiểm tra danh sách điểm kế hoạch gửi lên: Nếu phát hiện thiếu bất kỳ điểm kế hoạch nào của các ngày trong quá khứ (`evDateStr < todayVnStr`), hệ thống lập tức từ chối và thông báo lỗi `Nhân viên không được phép xóa điểm kế hoạch của các ngày đã qua trong tuần.`
    - Chặn đổi ngày hoặc đổi khách hàng của các điểm đã qua. Chặn thêm mới điểm vào các ngày đã qua.
    - Bộ lọc `toDelete` trên DB tuyệt đối không bao giờ xóa các điểm thuộc ngày đã qua đối với tài khoản Sales.
    - Nếu kế hoạch tuần đã nộp (`SUBMITTED`) hoặc đã được duyệt (`APPROVED`), khóa hoàn toàn quyền chỉnh sửa đối với Sales.
- **Quy Tắc Quản Lý Báo Cáo Thực Địa (Field Report Management):**
  - **Cho phép sửa báo cáo trong tuần đang diễn ra (Active Week Editing):**
    - Nhân viên Sales **được toàn quyền sửa đổi, bổ sung nội dung báo cáo** cho bất kỳ lượt viếng thăm nào thuộc tuần làm việc hiện tại (từ Thứ Hai đến Chủ Nhật).
    - Thao tác sửa/bổ sung báo cáo có thể thực hiện nhanh chóng ở mọi nơi: Tab *Check-in hôm nay*, Tab *Tổng kết tuần* (Review), và Tab *Lịch sử viếng thăm* (History).
  - **Chặn xóa trắng báo cáo (Anti-Erase):**
    - Nếu lượt viếng thăm đã được ghi nhận báo cáo trước đó, Sales không thể xóa sạch nội dung về chuỗi rỗng (`notes.trim() === ''`). Chỉ Quản lý mới có quyền hiệu chỉnh đặc biệt này.
  - **Khóa khi kết thúc tuần hoặc chốt nộp (Lock on Week End / Submission):**
    - Báo cáo của các tuần trước (`checkInDateStr < currentWeekMondayStr` theo giờ Việt Nam) sẽ tự động bị khóa chỉ đọc (`readOnly={true}`).
    - Khi kế hoạch tuần đã được bấm chốt nộp (`SUBMITTED`) hoặc Quản lý đã phê duyệt (`APPROVED`), toàn bộ báo cáo tuần đó được đóng băng để phục vụ đối soát và tính KPI.
  - **Giao diện Client (`QuickReportModal.tsx`):**
    - Khi ở trạng thái khóa chỉ đọc, hiển thị banner cảnh báo: `🔒 Báo cáo đã khóa: Báo cáo của tuần trước hoặc kế hoạch đã chốt duyệt không thể chỉnh sửa bởi nhân viên sales.` và vô hiệu hóa các nút lưu/thẻ gợi ý.
- **Quyền Quản Trị Của Quản Lý (Manager Override):**
  - Quản lý / Ban Giám Đốc (`isManager === true`) giữ toàn quyền điều chỉnh, bổ sung nhận xét hoặc thẩm định lại bất kỳ kế hoạch và báo cáo nào trong quá khứ khi cần thiết.

## Files

| File | Vai trò |
|---|---|
| `next.config.ts` | Cấu hình `Permissions-Policy: camera=(self), geolocation=(self)` cho phép trình duyệt sử dụng Camera và GPS |
| `i18n.ts` | Từ điển song ngữ (VI/EN) chuẩn hóa toàn bộ nhãn UI, preset hoạt động, ngày trong tuần, hook `useVisitLocale()`, và bộ phát sự kiện đồng bộ `sales_visits_locale_change` |
| `Header.tsx` | Thanh Header hệ thống tích hợp cụm nút chuyển ngữ `[ VI | EN ]` hiển thị riêng khi truy cập module Check-in, đồng bộ tiêu đề trang song ngữ |
| `actions.ts` | Server Actions được bảo vệ bởi `requireAuth()`: `reverseGeocodeAction()`, `quickCreateProspectCustomer()`, `checkInSalesVisit()`, `getWeeklyPlanWithVisits()`, `saveWeeklyPlanAction()`, `submitWeeklyReportAction()`, `saveManagerFeedbackAction()`, `getTeamWeeklySalesOverview()`, `getSalesVisitFullPhoto()`, `updateSalesVisitReportAction()` |
| `SalesVisitsClient.tsx` | Client component: 4 tab tác nghiệp Sales (Check-in hôm nay, Kế hoạch tuần, Tổng kết tuần, Lịch sử ảnh), Bảng Giám Sát Thị Trường Toàn Đội (Quản lý/CEO), tích hợp Offline Draft Queue, Modal hướng dẫn bật GPS, Bảng Tin Thực Địa Trực Tiếp và Modal Ghi Báo Cáo Nhanh |
| `QuickReportModal.tsx` | Modal ghi báo cáo nhanh thực địa: gợi ý thẻ 1-chạm ngành rượu vang, nhập ghi chú kết quả, đếm ký tự, lưu tức thì qua Server Action |
| `TodayLiveFeed.tsx` | Bảng tin báo cáo thực địa hôm nay của Ban Quản Lý: cập nhật theo thời gian thực, lọc theo nhân viên/trạng thái báo cáo, tìm kiếm toàn văn, xem ảnh camera và GPS |
| `LiveCameraModal.tsx` | Modal camera trực tiếp: nén ảnh tự động, tạo micro-thumbnail song song, watermark chân thực, cảnh báo GPS trong kính ngắm, hỗ trợ native camera fallback, hỗ trợ đa ngôn ngữ VI/EN |
| `page.tsx` | Server component nạp dữ liệu session, phân quyền `isManager` và danh bạ khách hàng tối ưu (không query thừa) |
| `docs/user-guide-sales-field-visit.md` | Sổ tay hướng dẫn sử dụng thực chiến (SOP) chi tiết cho Sales Rep (5 bước check-in, offline hầm rượu, kế hoạch tuần) & Quản lý (5 KPI, thẩm định GPS watermark, duyệt KPI) |
| `docs/Huong_Dan_Su_Dung_Checkin_Wine_ERP.pdf` | File hướng dẫn sử dụng định dạng PDF 7 trang A4 chuẩn in ấn doanh nghiệp kèm toàn bộ ảnh chụp màn hình thật từ hệ thống |

## Prisma Models

- `WeeklyVisitPlan` — Bảng kế hoạch tuần: `salesRepId`, `weekNumber`, `year`, `status`, `note`, `selfReview`, `managerFeedback`, `submittedAt`, `reviewedAt`, `reviewedById`
- `SalesVisitSchedule` — Chi tiết từng điểm trong kế hoạch: `planId`, `customerId`, `visitDate`, `purpose`, `status`, `isUnplanned`, `salesVisitId`, `resultNotes`
- `SalesVisit` — Lượt viếng thăm thực tế: `visitNo`, `customerId`, `salespersonId`, `status`, `purpose`, `activityType`, `scheduleId`, `isUnplanned`, `checkInTime`/`checkOutTime`, `checkInPhoto`/`checkOutPhoto`, GPS coords, `durationMinutes`, `notes`

## Enums
- `VisitStatus` — IN_PROGRESS, COMPLETED, CANCELLED

## Ràng Buộc (Constraints)
- 📸 Quy trình thực địa tinh gọn 1 lần: Check-in chụp ảnh thực tế tại điểm bán là hoàn tất ngay lượt viếng thăm (`COMPLETED`), không yêu cầu check-out.
- 📍 Bắt buộc chụp ảnh camera thực tế và có toạ độ GPS hợp lệ (hoặc lưu tạm ngoại tuyến nếu mất sóng).
- 📝 Phải lưu kế hoạch tuần trước khi chốt nộp báo cáo tuần.
