# Market Price & Tax Reference Module (Giá Thị Trường & Tra Cứu Thuế)

Phân hệ này phục vụ 2 mục tiêu song song:
1. **Theo dõi Giá thị trường** để biết vị thế giá của công ty so với cạnh tranh
2. **Tra cứu Thuế suất Nhập khẩu** theo từng quốc gia xuất xứ và Hiệp định thương mại — **Công cụ thiết yếu** vì NCC xuất phát từ nhiều quốc gia.

---

## 1. Quản Lý Giá Thị Trường (Market Price Tracking)

### A. Nguồn Dữ Liệu Giá
- **Nhập liệu thủ công (Manual):** Nhân viên Sales/Thu mua thường xuyên cập nhật giá cạnh tranh từ đối thủ, sàn thương mại, nhà hàng.
- **Export từ Excel** (Phù hợp vì công ty đang dùng Excel): Upload file Excel giá ngay vào hệ thống theo batch.
- **Tương lai (Phase 2):** Tích hợp Wine-Searcher API để tự động lấy giá thế giới theo từng Vintage.

### B. Theo Dõi Và So Sánh
- Mỗi SKU sẽ có 1 lịch sử Giá thị trường (MarketPriceHistory) ghi theo ngày
- Giao diện So sánh: **Giá thị trường vs Giá niêm yết của công ty vs Giá Vốn (Landed Cost)**
  - Cột "Margin Gap": Biết được mỗi chai đang bán lời bao nhiêu % so với thị trường
  - Cảnh báo màu ĐỎ nếu Giá Bán của công ty **thấp hơn** hoặc bằng Giá Vốn sau Thuế
- **Biểu đồ xu hướng giá** theo thời gian cho SKU cao cấp (Grand Cru, En Primeur)

### C. Định giá Bán Thông minh
- Hệ thống gợi ý (Suggest) giá bán tối thiểu dựa trên: `Landed Cost × (1 + Margin Target %)`
- CEO/Trưởng Sales có thể set `Margin Target` theo từng Kênh (HoReCa 20%, Đại lý 15%, Bán lẻ VIP 30%)

---

## 2. Module Tra Cứu Thuế Suất Nhập Khẩu (Tax Reference & Rate Lookup)

Đây là tính năng **trọng tâm** khi NCC đến từ nhiều quốc gia. Việc tính sai thuế suất NK ảnh hưởng trực tiếp đến giá vốn và lợi nhuận.

### A. Cơ Sở Dữ Liệu Thuế Suất (Tax Rate Database)
Hệ thống sẽ lưu bảng `TaxRate` theo cấu trúc:

```
TaxRate {
  hscode:             String  // HS Code rượu vang (Ví dụ: 2204.21)
  country_of_origin:  String  // Quốc gia xuất xứ (VN, FR, IT, CL, AU, US, ES...)
  trade_agreement:    String? // Hiệp định áp dụng (EVFTA, AANZFTA, VKFTA, MFN...)
  import_tax_rate:    Decimal // Thuế Nhập Khẩu (%)
  sct_rate:           Decimal // Thuế TTĐB — thường 35% hoặc 65% theo ABV
  vat_rate:           Decimal // VAT (thường 10%)
  effective_date:     Date    // Ngày hiệu lực (Thuế EVFTA giảm theo lộ trình năm)
  expiry_date:        Date?   // Ngày hết hiệu lực
  requires_co:        Boolean // Có cần C/O chứng nhận xuất xứ không?
  co_form_type:       String? // Loại form C/O (EUR.1, Form D, Form VC, Form AK...)
  notes:              String? // Ghi chú đặc biệt
}
```

### B. Các Hiệp Định Thương Mại Quan Trọng (Rượu Vang)

| Quốc gia | Hiệp định | Thuế NK Gốc (MFN) | Thuế NK Ưu đãi | C/O Form | Ghi chú |
|---|---|---|---|---|---|
| Pháp, Ý, Tây Ban Nha, Đức... | **EVFTA** | ~50% | Giảm dần từ 2020, về 0% theo lộ trình | EUR.1 / REX | Quan trọng nhất cho Rượu Vang Châu Âu |
| Úc | **AANZFTA** | ~50% | Ưu đãi nhất định | Form AANZ | |
| New Zealand | **AANZFTA** | ~50% | Ưu đãi | Form AANZ | |
| Chile | **VCFTA** | ~50% | Giảm theo lộ trình | Form VC | |
| Mỹ | MFN (Chưa FTA) | ~50% | **Không có ưu đãi** | Không | Chi phí cao nhất |
| Nam Phi | MFN | ~50% | Không | Không | |
| Argentina | MFN | ~50% | Không | Không | |

### C. Giao Diện Tra Cứu (Tax Lookup UI)
- Nhâp viên Thu mua trước khi tạo PO → **Tra cứu nhanh:** Chọn Quốc gia + HS Code → Hệ thống trả về ngay:
  - Thuế NK hiện hành
  - Có cần C/O không? Loại form gì?
  - Lịch sử thay đổi thuế suất (EVFTA lộ trình năm hiện tại là bao nhiêu?)
- **Tax Rate đúng Năm hiện tại** được tự động apply khi tạo mới Shipment
- Admin có thể **cập nhật bảng thuế** (Upload Excel hoặc sửa trực tiếp) khi Bộ Tài chính ban hành thông tư mới

### D. Xuất Báo Cáo
- Báo cáo "Chi phí Thuế theo Quốc gia" — Giúp CEO so sánh tổng chi phí nhập khẩu Wine từ Pháp (EVFTA) vs Mỹ (MFN) để ra quyết định chiến lược nguồn hàng
