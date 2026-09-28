# CRM — Customer Relationship Management (Quản Lý Quan Hệ Khách Hàng)

Phân hệ CRM trong Wine ERP không chỉ lưu dữ liệu khách hàng (việc đó thuộc MDM), mà là nơi **quản lý toàn bộ vòng đời quan hệ** với từng khách hàng — từ lần đầu tiếp cận, lịch sử tương tác, sở thích mua, cho đến hành trình phát triển lên khách VIP.

Ngành rượu vang cao cấp rất chú trọng CRM vì:
- Khách mua Grand Cru thường là mối quan hệ dài hạn, cần chăm sóc cá nhân hóa
- Allocation bán cho ai phụ thuộc nhiều vào lịch sử mua và độ ưu tiên của KH
- Tasting event, winery tour là kênh bán hàng quan trọng cho khách VIP

---

## 1. Profile Toàn Diện của Khách Hàng (360° Customer View) ✅ Đã Triển Khai

Màn hình tổng hợp 360° cho phép mọi thành viên Sales nhìn vào 1 màn hình và biết toàn bộ lịch sử của 1 khách hàng:

### A. Thông Tin Cơ Bản & Liên Hệ
- Hồ sơ cơ bản từ MDM (Tên, MST, loại, kênh, Sales phụ trách...)
- **Danh sách Người Liên Hệ (Contacts):** Mỗi KH HORECA có thể có nhiều người liên hệ (Giám đốc F&B, Bếp trưởng, Kế toán thanh toán) — Lưu tên, SĐT, chức vụ, Email
- Ghi Chú Nội Bộ (Internal Notes): Văn phòng có thể ghi chú riêng tư không hiển thị ra ngoài

### B. Lịch Sử Giao Dịch
- Tổng doanh số all-time, trong năm, trong tháng
- Danh sách tất cả Sales Order đã tạo (Click vào xem chi tiết)
- Top SKU khách hàng hay mua nhất
- Tần suất đặt hàng (Hàng tuần, hàng tháng, thất thường)

### C. Tình Trạng Công Nợ (Real-time AR Status)
- Tổng dư nợ hiện tại / Credit Limit còn lại
- Aging: Số nợ trong hạn 0-30 ngày / Quá hạn 30-60 ngày / Quá hạn 60-90 ngày / Quá hạn >90 ngày
- Biểu đồ thanh toán: Khách có hay thanh toán đúng hạn không?
- **Credit Hold Alert:** Nếu KH vượt Credit Limit → Cảnh báo đỏ trên profile

### D. Sở Thích & Khẩu Vị (Wine Preference Profile)
- Giống nho yêu thích (Pinot Noir, Barolo...)
- Vùng trồng ưa thích (Burgundy, Châteauneuf-du-Pape...)
- Mức giá thường mua (500k-1M/chai / 1M-3M / Trên 3M)
- Ghi chú khẩu vị từ Tasting Event (do Sales điền sau khi tiếp xúc)

---

## 2. Quản Lý Hoạt Động (Activity & Interaction Log) ✅ Đã Triển Khai

Sales Rep ghi lại mọi tương tác để không bị mất thông tin khi bàn giao khách hàng:

| Loại hoạt động | Mô tả |
|---|---|
| 📞 Cuộc gọi (Call) | Ghi chú nội dung cuộc gọi, kết quả |
| 📧 Email | Link email / nội dung tóm tắt |
| 🤝 Gặp mặt (Meeting) | Thời gian, địa điểm, người tham dự, kết quả |
| 🍷 Tasting Event | KH tham gia buổi thử rượu nào, phản hồi |
| 📦 Giao hàng | Ghi chú đặc biệt khi giao (KH vắng mặt, yêu cầu giao lại...) |
| ⚠️ Khiếu nại (Complaint) | Ghi nhận và theo dõi xử lý khiếu nại |

---

## 3. Sales Pipeline (Quản Lý Cơ Hội Bán Hàng) ✅ Đã Triển Khai

Dành cho Sales Manager theo dõi tiến độ chuyển đổi khách tiềm năng:

```
LEAD (Tiềm năng) → QUALIFIED (Đủ điều kiện) → PROPOSAL (Đề xuất) → NEGOTIATION (Đàm phán) → WON (Chốt) / LOST (Thua)
```

| Trường | Mô tả |
|---|---|
| `opportunity_name` | Tên cơ hội (Ví dụ: "Grand Cru Set cho nhà hàng Park Hyatt") |
| `expected_value` | Giá trị ước tính (VND) |
| `expected_close_date` | Ngày dự kiến chốt |
| `stage` | Giai đoạn trong pipeline |
| `probability` | % xác suất thành công |
| `assigned_to` | Sales Rep phụ trách |
| `notes` | Ghi chú tiến độ |

**Dashboard Pipeline cho Sales Manager:** Biểu đồ Funnel thể hiện bao nhiêu deal đang ở mỗi stage, tổng giá trị pipeline.

---

## 4. Phân Hạng & Chương Trình Khách Hàng (Customer Segmentation) ✅ Đã Triển Khai

### A. Phân Hạng Tự Động (Automatic Tier)
Hệ thống tự động tính toán hạng khách dựa trên doanh số và tần suất mua. Có nút **Recalc Tiers** trên trang CRM:

| Hạng | Điều kiện mẫu | Quyền lợi |
|---|---|---|
| **Bronze** | Mua < 50M/năm | Giá HORECA/Wholesale chuẩn |
| **Silver** | Mua 50M–200M/năm | Ưu tiên xem catalog mới trước |
| **Gold** | Mua 200M–500M/năm | Được tham gia Tasting Event riêng |
| **Platinum** | Mua > 500M/năm | Ưu tiên Allocation Grand Cru, giá đặc biệt |

*(Ngưỡng và tên hạng có thể Admin tùy chỉnh)*

### B. Nhãn Tùy Chỉnh (Custom Tags)
Sales có thể gán nhãn thủ công: `VIP`, `Potential`, `Price-sensitive`, `Wine Collector`, `Loyal`, `At-risk`...

---

## 5. Tasting Event & Winery Tour Management ✅ Đã Triển Khai

Quản lý các sự kiện nếm thử rượu — kênh marketing quan trọng nhất cho rượu vang cao cấp:

| Tính năng | Mô tả |
|---|---|
| Tạo Sự Kiện | Tên, ngày, địa điểm, SKU được giới thiệu, người tổ chức |
| Danh Sách Khách Mời | Gửi lời mời + track RSVP (Đồng ý/Từ chối/Chờ) |
| Điểm Danh | Check-in tại event |
| Ghi Chép Phản Hồi | Sales Rep điền feedback của từng KH tại event (Thích SKU nào, không thích gì) |
| Theo Dõi Chuyển Đổi | Sau event, KH nào đã mua? Mua SKU nào? → Đo ROI của từng event |

---

## 6. Quản Lý Khiếu Nại (Customer Complaint / Ticket) ✅ Đã Triển Khai

Hệ thống theo dõi khiếu nại từ đầu đến cuối:

```
KH khiếu nại → Sales tạo Ticket → Phân bổ cho bộ phận xử lý → Xử lý → Đóng Ticket → Follow-up với KH
```

| Trường | Mô tả |
|---|---|
| `ticket_type` | Hàng vỡ/hỏng / Giao sai SKU / Thiếu số lượng / Phàn nàn chất lượng / Khác |
| `severity` | LOW / MEDIUM / HIGH / CRITICAL |
| `linked_so` | Liên kết với Sales Order gốc |
| `resolution` | Cách xử lý: Đổi hàng / Credit Note / Xin lỗi / Không thụ lý |
| `sla_deadline` | Deadline xử lý theo SLA |

---

## 7. Tích Hợp Với Các Module Khác

```
CRM (Customer Profile)
  ├──→ MDM (Lấy thông tin cơ bản: Credit Limit, Payment Term)
  ├──→ SLS (Mỗi SO phải chọn Customer từ CRM)
  ├──→ FIN (Công nợ AR theo dõi per Customer)
  ├──→ TRS (Địa chỉ giao hàng từ Customer Addresses)
  ├──→ CSG (Consignment Agreement với HORECA Customer)
  └──→ DSH (CEO thấy Top 10 KH doanh số cao nhất)
```

---

## 8. Database Design

- `Customer` (MDM) ← Dữ liệu gốc
- `CustomerContact`: Nhiều người liên hệ per Customer
- `CustomerActivity`: Log tất cả tương tác (Call, Meeting, Email, Tasting...)
- `SalesOpportunity`: Pipeline deal đang theo dõi
- `CustomerTier`: Hạng KH theo kỳ (Có thể thay đổi hàng năm)
- `TastingEvent`: Sự kiện nếm thử
- `TastingEventAttendee`: KH tham dự + Phản hồi
- `ComplaintTicket`: Khiếu nại và lịch sử xử lý
- `WinePreference`: Sở thích rượu vang của KH
- `CustomerTag`: Nhãn tùy chỉnh (VIP, At-risk, EVFTA, Price-sensitive...)
- `LoyaltyTransaction`: Lịch sử giao dịch tích điểm

---

## 9. Implementation Notes (07/03/2026)

**UI đã triển khai tại `/dashboard/crm`:**
- ✅ 360° Customer View với sidebar KH + panel chi tiết
- ✅ Activity Log nhanh (CALL/EMAIL/MEETING/TASTING/OTHER)
- ✅ Contacts & Tags CRUD panel
- ✅ Wine Preference panel
- ✅ Tasting Events panel (tab riêng)
- ✅ Complaint Tickets panel (tab riêng)
- ✅ Transaction History: All-time revenue, top SKU, all orders, AR invoices
- ✅ Recalc Tiers (PLATINUM ≥ 5 tỷ, GOLD ≥ 2 tỷ, SILVER ≥ 500M, BRONZE)
- ✅ **Format doanh số**: Hiển thị "8.75 tỷ ₫" thay vì "8754M" — phù hợp người Việt
- ✅ **Credit Limit**: Format chuẩn VND (200.000.000 ₫)

---

## 10. Quản Lý Kế Hoạch, Mục Tiêu Tìm Kiếm KH & Cuộc Gọi Hàng Ngày (Telesales & Prospecting Hub) ✅ Đã Triển Khai (25/09/2026)

Phân hệ chuyên biệt dành cho đội ngũ **Corporate Sales (B2B)** và **Retail Sales (B2C)** để quản lý kế hoạch tìm kiếm khách hàng mới, thiết lập mục tiêu chỉ tiêu tháng/ngày và theo dõi nhật ký cuộc gọi hàng ngày.

### A. Phân Luồng Kênh Bán Hàng (Channel Separation)
- **Corporate Sales (B2B)**: Tìm kiếm khách hàng doanh nghiệp, quà tặng lễ tết, sự kiện công ty, nhà hàng / khách sạn / đối tác phân phối.
  - Chỉ tiêu cuộc gọi tiêu chuẩn: 10 - 15 cuộc/ngày (đòi hỏi nghiên cứu sâu profile doanh nghiệp trước khi gọi).
- **Retail Sales (B2C)**: Tìm kiếm khách lẻ VIP, người sành vang, khách tham quan showroom, thành viên câu lạc bộ vang.
  - Chỉ tiêu cuộc gọi tiêu chuẩn: 20 - 30 cuộc/ngày (tốc độ tiếp cận nhanh, mời dự tasting, chăm sóc định kỳ).

### B. Thiết Lập & Quản Lý Mục Tiêu (Prospecting Targets & Daily Quotas)
- Quản lý cấp Quản lý (Manager) có thể thiết lập chỉ tiêu linh hoạt cho từng nhân viên sale:
  - **Mục tiêu Cuộc gọi / ngày (Daily Call Quota)**: Lưu vào hệ thống KPI (`CALLS_DAILY`).
  - **Mục tiêu Lead mới trong tháng (New Leads Target)**: Chỉ tiêu số khách tiềm năng cần thu thập (`NEW_LEADS`).
  - **Mục tiêu Cơ hội bán hàng tạo mới (Deals Target)**: Chỉ tiêu số deal triển vọng được mở trong pipeline (`DEALS_COUNT`).

### C. Nhật Ký Cuộc Gọi Nhanh 1-Chạm (Quick Call Logger)
- Sales có thể log cuộc gọi ngay cả khi khách chưa có mã chính thức trong CRM (tránh rào cản hành chính khi săn khách mới):
  - Thông tin: Tên người liên hệ, Công ty/Tổ chức (Corporate), SĐT, Kênh (Corporate/Retail).
  - Phân loại cuộc gọi: Giới thiệu lần đầu (Cold Call), Chăm sóc / Khảo sát (Follow-up), Mời thử vang (Tasting Invite), Báo giá / Đề xuất (Quotation), Chăm sóc sau bán (After-sales).
  - Kết quả chuẩn hóa: Quan tâm báo giá, Đã chốt hẹn gặp, Khách bận hẹn gọi lại, Không nghe máy, Sai số, Chốt đơn thành công.
  - Ghi chú & Lịch hẹn gọi lại (Follow-up Date).
  - Tự động đồng bộ sang `CustomerActivity` nếu cuộc gọi gắn với khách hàng đã có mã.

### D. Bảng Tiến Độ Thời Gian Thực & Ma Trận Đội Ngũ (Live Leaderboard & Progress Tracking)
- **4 Thẻ Chỉ Số KPI Realtime**:
  1. *Cuộc gọi hôm nay*: Tổng số cuộc gọi toàn đội / tổng chỉ tiêu ngày, kèm % hoàn thành.
  2. *Tỷ lệ kết nối thành công*: % cuộc gọi kết nối được (có phản hồi, hẹn gặp hoặc báo giá).
  3. *Lead mới tháng này*: Số khách tiềm năng mới tìm kiếm được.
  4. *Deals tạo mới tháng này*: Số cơ hội bán hàng phát sinh từ các cuộc gọi.
- **Tiến Độ Từng Nhân Viên (Sales Rep Progress Cards)**:
  - Thanh tiến độ cuộc gọi trực quan: `Đã gọi X / Chỉ tiêu Y cuộc` với màu sắc trực quan (Xanh: đạt/vượt, Vàng/Xám: đang thực hiện).
  - Tỷ lệ hoàn thành mục tiêu Lead mới và Deals tháng.
  - Lọc theo kênh Corporate hoặc Retail để Sales Manager đánh giá chuyên biệt.

### E. Chuyển Đổi Nhanh Sang Khách Hàng Chính Thức (1-Click Convert to Customer)
- Ngay tại nhật ký cuộc gọi, khi khách tiềm năng đồng ý nhận báo giá hoặc chốt đơn:
  - Nút **[+ Mở Mã Khách]** mở modal chuyển đổi nhanh.
  - Tự động sinh mã khách chuẩn doanh nghiệp (`CORP-XXXXX` cho Corporate, `RET-XXXXX` cho Retail).
  - Tự động gán Salesperson phụ trách và liên kết toàn bộ lịch sử cuộc gọi trước đó vào hồ sơ 360° của khách hàng mới tạo.

---

## 11. Kế Hoạch Cuộc Gọi & Báo Cáo Cuộc Gọi Telesales (Sales Call Planner & Reporting) ✅ Đã Triển Khai (26/09/2026)

Hệ thống quản lý kế hoạch gọi điện chủ động dành cho Telesales làm việc tại nhà hoặc văn phòng:

### A. Phương Thức Lập Kế Hoạch (Phương Án C - Hybrid)
- **Telesale tự lập kế hoạch**: Telesale tự chọn khách hàng cũ hoặc thêm danh sách đầu mối tiềm năng mới vào To-Call List của ngày.
- **Quản lý phân bổ danh sách gọi (Batch Assignment)**: Trưởng phòng/Admin lọc danh sách khách hàng trong CRM và giao chỉ định hàng loạt cho một hoặc nhiều Telesale.
- **Quy tắc Lead**: Đầu mối tiềm năng (Lead) hoàn toàn **không yêu cầu nhập giá trị tiền** (chỉ lưu Tên, Công ty, SĐT, Kênh Corporate/Retail, Mục đích gọi, Ghi chú chuẩn bị).

### B. Nút Gọi 1-Chạm Trên Điện Thoại (Click-to-Call) & Cơ Chế Tracking
- Nút **[📞 Gọi Ngay]** to bản trên giao diện điện thoại kích hoạt trực tiếp `tel:...` sang trình quay số điện thoại mặc định.
- **Tracking thời gian rời màn hình**: Hệ thống lắng nghe sự kiện `visibilitychange` để ước lượng thời lượng cuộc gọi khi Telesale quay lại trình duyệt web.
- **Tự động mở Popup Báo Cáo Cuộc Gọi**: Ngay khi cúp máy và mở lại web, hệ thống tự động bật form để Telesale điền báo cáo kết quả cuộc gọi ngay trong 15-30 giây.

### C. Báo Cáo Kết Quả Cuộc Gọi (Call Outcome Report)
- Phân loại kết quả chuẩn: Quan tâm báo giá, Đã chốt đơn, Hẹn gọi lại, Khách bận, Không nghe máy, Từ chối, Sai số.
- Lưu thời lượng cuộc gọi và ghi chú nội dung trao đổi.
- Tự động cập nhật trạng thái mục kế hoạch thành `COMPLETED`, lưu vào `SalesCallLog` và `CustomerActivity`.
- Hẹn ngày gọi lại (`followUpDate`) tự động lên lịch nhắc nhở.

### D. Giám Sát & Báo Cáo Kiểm Soát Dành Cho Quản Lý
- Bảng tiến độ hoàn thành kế hoạch gọi (% Đã gọi / Kế hoạch ngày) theo từng nhân viên.
- Phân loại theo kênh Corporate và Retail.
- Nút **[Xuất CSV Báo Cáo]**: Xuất file CSV chi tiết toàn bộ kế hoạch và kết quả cuộc gọi của Telesales theo khoảng thời gian.


