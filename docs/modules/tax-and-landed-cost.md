# Tax & Landed Cost Calculation (Đối với Rượu Vang)

Một trong những nghiệp vụ khó nhất của ERP Nhập khẩu Rượu Vang là tính toán Costing (Landed Cost). Vì rượu vang chịu nhiều loại thuế chồng lên nhau (Thuế chồng thuế), hệ thống sẽ cần một **Tax Engine** thiết kế chuẩn ngay từ đầu.

## 1. Công Thức Tính Các Loại Thuế Nhập Khẩu Rượu Vang

Rượu Vang khi nhập khẩu thường phải chịu 3 loại thuế chính: Thuế Nhập Khẩu (Import Tax), Thuế Tiêu Thụ Đặc Biệt (SCT/TTĐB), và Thuế Giá Trị Gia Tăng (VAT).

### A. Giá tính thuế gốc: Giá CIF
- **CIF (Cost, Insurance, Freight):** Bao gồm Giá mua trên hóa đơn (FOB/EXW) + Phí Vận Chuyển Quốc Tế + Phí Bảo Hiểm.

### B. Thuế Nhập Khẩu (Import Tax)
- **Công thức:** `Thuế Nhập Khẩu = Giá CIF * Thuế suất Nhập Khẩu`
- **Ghi chú:** Với các nước châu Âu có hiệp định EVFTA, thuế suất đang giảm theo lộ trình (ví dụ: gốc 50%, nhưng có C/O form EUR.1 có thể giảm theo năm). ERP cần có bảng `Tax Rates` có hiệu lực theo thời gian (Effective Date).

### C. Thuế Tiêu Thụ Đặc Biệt (SCT - Special Consumption Tax)
- **Cơ sở tính thuế:** `Giá tính thuế TTĐB = Giá CIF + Thuế Nhập Khẩu`
- **Công thức:** `Thuế TTĐB = Giá tính thuế TTĐB * Thuế suất TTĐB`
- **Ghi chú:** Rượu vang (ABV) từ 20 độ trở lên (thường là vang cường hóa) chịu mức thuế 65%. Rượu vang dưới 20 độ (hầu hết vang thông thường 12-15%) chịu mức thuế **35%**. Hệ thống phải đọc chỉ số ABV trong Master Data để tự động áp dụng 35% hay 65%.

### D. Thuế Giá Trị Gia Tăng (VAT)
- **Cơ sở tính thuế:** `Giá tính thuế VAT = Giá CIF + Thuế Nhập Khẩu + Thuế TTĐB`
- **Công thức:** `Thuế VAT = Giá tính thuế VAT * 10%`

## 2. Landed Cost (Tính Giá Vốn Nhập Kho - COGS)

ERP không chỉ tính thuế cho cơ quan Hải quan mà phải phân bổ tất cả chi phí vào **Giá Nhập Kho (Unit Cost)** để tính Lợi Nhuận Gộp (Gross Margin) chính xác trên Dashboard của CEO.

**Tổng Chi Phí (Total Invoice Cost) bao gồm:**
1. Giá mua Hàng hóa (FOB)
2. Thuế Nhập Khẩu (Import Tax)
3. Thuế TTĐB (SCT)
4. *Lưu ý: Thuế VAT thường được khấu trừ, KHÔNG tính vào giá vốn phẩm (trừ vài trường hợp đặc biệt).*
5. Các chi phí Logistic nội địa phân bổ (Cước vận tải từ cảng về kho, Phí lưu container, Phí lưu bãi, Phí mở tờ khai, Tem nhãn phụ...).

**Thuật toán Phân Bổ (Proration Algorithm):**
Mọi chi phí hải quan và nội địa cho lô hàng/container sẽ được hệ thống phân bổ xuống từng chai rượu dựa trên:
- Phân bổ theo giá trị (Value-based) - Thường áp dụng.
- Phân bổ theo số lượng/lít (Quantity/Volume-based) - Dùng cho cước phí vận chuyển.

## 3. Database Design Ý tưởng

Hệ thống cần các bảng:
- `TaxCategory`: Quản lý các loại thuế (Import, SCT_Under20, SCT_Over20, VAT10).
- `PurchaseOrder` & `PurchaseOrderLine`: Ghi nhận đơn hàng ngoại.
- `LandedCostCampaign`: Ghi nhận lô hàng nhập khẩu (Bill of Lading).
- `LandedCostInvoice`: Hóa đơn chi phí cho Logistic, Dịch vụ cảng kết nối vào Campaign.
- `ItemCostHistory`: Lưu trữ giá nhập thực tế sau khi đã tính toán đầy đủ thuế và phí phân bổ để sẵn sàng cho báo cáo Lợi nhuận.
