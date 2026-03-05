# CST — Product Costing (Tính Giá Vốn & Đề Xuất Giá Bán)
> Module xác định chính xác giá vốn từng chai rượu và đề xuất giá bán theo chính sách biên lợi nhuận.

---

## 1. Tại Sao Costing Quan Trọng

Rượu vang nhập khẩu có cấu trúc chi phí phức tạp:
- **Giá CIF** bằng ngoại tệ (USD/EUR) → Phụ thuộc tỷ giá
- **3 lớp thuế** cộng dồn (Thuế NK → Thuế TTĐB → VAT)
- **Chi phí phụ** biến động (phí cảng, logistics, bảo hiểm, lưu kho)
- **Chi phí phân bổ** theo trọng số (Đồng một container nhiều SKU)
- → **Giá vốn thực ≠ Giá CIF × Tỷ giá** (sai số lên đến 60–80%)

---

## 2. Công Thức Landed Cost / Chai

```
Giá Vốn 1 Chai = (
  CIF_per_bottle × Exchange_Rate
  + Import_Duty_per_bottle
  + SCT_per_bottle
  + VAT_on_SCT_base_per_bottle        ← VAT tính trên base = CIF + ND + SCT
  + Logistics_Cost_per_bottle
  + Customs_Fee_per_bottle
  + Other_per_bottle                  ← Bảo hiểm, phí C/O, phí đại lý HQ
)
```

### Chi tiết tính thuế (ví dụ):
```
Giá CIF 1 chai: $20 × 25,500 = 510,000 VND
Thuế NK (50%):  510,000 × 50%  = 255,000 VND
Thuế TTĐB (65%): (510,000 + 255,000) × 65% = 497,250 VND
Thuế VAT (10%): (510,000 + 255,000 + 497,250) × 10% = 126,225 VND
─────────────────────────────────────────────────
Thuế tổng / chai:  878,475 VND
Logistics / chai:   35,000 VND
─────────────────────────────────────────────────
GIÁ VỐN / CHAI:    510,000 + 878,475 + 35,000 = 1,423,475 VND
```

---

## 3. Phân Bổ Chi Phí (Multi-SKU Shipment)

Một container thường nhập nhiều SKU khác nhau. Chi phí logistics thực chất là chung cả container → Phải phân bổ:

### 3 Phương Pháp Phân Bổ

| Phương pháp | Cách tính | Khi dùng |
|---|---|---|
| **Theo số chai (Quantity)** | Chi phí ÷ Tổng số chai | Chi phí đồng đều (phí bốc vác) |
| **Theo CIF value (Value)** | Chi phí × (CIF_SKU ÷ CIF_Total) | Phí bảo hiểm, thuế tỷ lệ value |
| **Theo trọng lượng (Weight)** | Chi phí × (Weight_SKU ÷ Weight_Total) | Phí vận chuyển nội địa |

**Hệ thống hỗ trợ:** Chọn phương pháp phân bổ riêng cho từng dòng chi phí.

---

## 4. Costing Workflow

```
1. Tạo Landed Cost Campaign (khi Shipment về cảng)
   ↓
2. Nhập chi phí thực tế:
   - Phí logistics (Invoice từ forwarder)
   - Phí cảng/lưu kho (Invoice từ cảng)
   - Phí đại lý hải quan
   - Phí C/O, kiểm tra chất lượng
   ↓
3. Hệ thống Auto-calculate:
   - Thuế NK / SKU (từ TaxRate table)
   - Thuế TTĐB / SKU (dựa trên ABV%)
   - VAT / SKU
   - Phân bổ logistics theo phương pháp đã chọn
   ↓
4. Review & Approve Landed Cost
   ↓
5. Lock → Cập nhật Unit Landed Cost vào StockLot
   ↓
6. → Đề xuất Giá Bán tự động
```

---

## 5. Đề Xuất Giá Bán (Price Suggestion)

Sau khi có Giá Vốn → Hệ thống đề xuất giá theo từng kênh:

```
Giá Vốn: 1,423,475 VND/chai

Kênh      | Target Margin | Giá đề xuất    | Làm tròn
─────────────────────────────────────────────────────
HORECA    |  55%          | 3,163,278      | 3,150,000
Wholesale |  45%          | 2,588,136      | 2,590,000
VIP Retail|  65%          | 4,067,071      | 4,050,000
POS       |  70%          | 4,744,917      | 4,750,000
```

**Công thức:** `Giá bán = Giá vốn ÷ (1 - Margin%)`

**Margin target** được cấu hình trong Settings → Price Policy theo từng Channel.

---

## 6. Sensitivity Analysis (Phân Tích Độ Nhạy)

Cho phép CEO/Finance thấy: "Nếu tỷ giá tăng 3% thì giá vốn thay đổi bao nhiêu?"

```
Tỷ giá cơ sở: 25,500 VND/USD
            ┌──────────────────────────────────────────┐
            │  Tỷ giá  │ Giá Vốn  │  HORECA 55% │ Margin │
            │ 24,500   │ 1,369,k  │  3,042,k    │ 55%    │
            │ 25,000   │ 1,396,k  │  3,102,k    │ 55%    │
            │ 25,500   │ 1,423,k  │  3,163,k    │ 55%    │← Hiện tại
            │ 26,000   │ 1,450,k  │  3,222,k    │ 55%    │
            │ 26,500   │ 1,477,k  │  3,282,k    │ 55%    │
            └──────────────────────────────────────────┘
```

---

## 7. Costing vs Giá Bán Thực Tế

Hệ thống **so sánh** giá vốn với giá đang bán thực tế → Phát hiện SKU bán dưới giá vốn:

| SKU | Giá Vốn | Giá Bán H. tại | Margin Thực | Alert |
|---|---|---|---|---|
| Bordeaux A | 420,000 | 850,000 | 50.6% | ✅ |
| Burgundy B | 1,230,000 | 1,100,000 | **-11.8%** | 🔴 Bán lỗ |
| Champagne C | 890,000 | 1,980,000 | 55.1% | ✅ |

→ Alert nếu Margin < 0% hoặc < Threshold.

---

## 8. Tích Hợp Các Module

| Module | Kết nối |
|---|---|
| **PRC/TAX** | Lấy thuế suất tự động cho tính toán |
| **WMS** | Cập nhật `unit_landed_cost` vào StockLot |
| **SLS** | Đề xuất giá cho Quotation/Price List |
| **FIN** | COGS khi bán = Landed Cost × Qty sold |
| **RPT** | Report Margin Analysis per SKU/Channel |
| **DSH** | KPI Gross Margin trực tiếp từ Costing data |

---

## 9. Database Design

```
LandedCostCampaign {
  id, shipment_id, status (DRAFT|CONFIRMED|ALLOCATED),
  total_import_duty, total_sct, total_vat,
  total_logistics, total_other,
  allocation_method (QUANTITY|VALUE|WEIGHT),
  approved_by, approved_at
}

LandedCostLine {
  id, campaign_id, cost_type, amount,
  description, invoice_ref
}

LandedCostAllocation {
  id, campaign_id, product_id, qty,
  cif_value_usd, exchange_rate,
  import_duty, sct, vat, logistics_alloc,
  unit_landed_cost  ← Quan trọng nhất
}

PriceSuggestion {
  id, product_id, campaign_id,
  unit_cost, channel, target_margin,
  suggested_price, suggested_rounded,
  created_at
}
```

*Last updated: 2026-03-04 | Wine ERP v4.0*
