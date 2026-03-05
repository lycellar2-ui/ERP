# CRM — Customer Relationship Management (Quản Lý Quan Hệ Khách Hàng)

Phân hệ CRM trong Wine ERP không chỉ lưu dữ liệu khách hàng (việc đó thuộc MDM), mà là nơi **quản lý toàn bộ vòng đời quan hệ** với từng khách hàng — từ lần đầu tiếp cận, lịch sử tương tác, sở thích mua, cho đến hành trình phát triển lên khách VIP.

Ngành rượu vang cao cấp rất chú trọng CRM vì:
- Khách mua Grand Cru thường là mối quan hệ dài hạn, cần chăm sóc cá nhân hóa
- Allocation bán cho ai phụ thuộc nhiều vào lịch sử mua và độ ưu tiên của KH
- Tasting event, winery tour là kênh bán hàng quan trọng cho khách VIP

---

## 1. Profile Toàn Diện của Khách Hàng (360° Customer View)

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

## 2. Quản Lý Hoạt Động (Activity & Interaction Log)

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

## 3. Sales Pipeline (Quản Lý Cơ Hội Bán Hàng)

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

## 4. Phân Hạng & Chương Trình Khách Hàng (Customer Segmentation)

### A. Phân Hạng Tự Động (Automatic Tier)
Hệ thống tự động tính toán hạng khách dựa trên doanh số và tần suất mua:

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

## 5. Tasting Event & Winery Tour Management

Quản lý các sự kiện nếm thử rượu — kênh marketing quan trọng nhất cho rượu vang cao cấp:

| Tính năng | Mô tả |
|---|---|
| Tạo Sự Kiện | Tên, ngày, địa điểm, SKU được giới thiệu, người tổ chức |
| Danh Sách Khách Mời | Gửi lời mời + track RSVP (Đồng ý/Từ chối/Chờ) |
| Điểm Danh | Check-in tại event |
| Ghi Chép Phản Hồi | Sales Rep điền feedback của từng KH tại event (Thích SKU nào, không thích gì) |
| Theo Dõi Chuyển Đổi | Sau event, KH nào đã mua? Mua SKU nào? → Đo ROI của từng event |

---

## 6. Quản Lý Khiếu Nại (Customer Complaint / Ticket)

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
