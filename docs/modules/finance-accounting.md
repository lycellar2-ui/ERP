# Finance, Accounting & Legal Declarations — FIN
**Module:** `FIN` | Người dùng: Kế Toán, CEO | Ưu tiên: 🟡 P2

Phân hệ tài chính phục vụ 2 mục tiêu: **Kế toán quản trị nội bộ** và **Tuân thủ pháp lý Việt Nam** (Thuế, Hóa đơn điện tử, Tờ khai). Vì công ty đang dùng Excel, mọi output phải xuất được Excel chuẩn.

---

## 1. Accounts Payable — AP (Công Nợ Phải Trả)

**Nguồn sinh AP:** PO được duyệt → Shipment về → Xác nhận GR → Hệ thống tự sinh AP Invoice

| Tính năng | Mô tả |
|---|---|
| AP Invoice từ PO | Hệ thống sinh tự động, Kế toán Review & Confirm số liệu |
| Multi-currency | Hóa đơn NCC ngoại tệ (USD/EUR) → Ghi nhận tỷ giá tại ngày giao dịch |
| Lịch thanh toán | Theo dõi ngày đến hạn L/C, T/T — Alert 7 ngày trước deadline |
| AP Aging Report | Phân tầng nợ: Chưa đến hạn / 0-30 / 30-60 / >60 ngày quá hạn |
| Partial Payment | Thanh toán nhiều lần cho 1 invoice (Trả một phần trước) |

---

## 2. Accounts Receivable — AR (Công Nợ Phải Thu)

**Nguồn sinh AR:** SO Delivered → E-Invoice phát hành → AR Invoice tạo với due date tính theo Payment Term KH

| Tính năng | Mô tả |
|---|---|
| AR Invoice | Tự sinh từ SO sau khi giao hàng xác nhận (E-POD confirm) |
| Thanh toán ghi nhận | Nhập thanh toán: Tiền mặt, Chuyển khoản, COD từ TRS module |
| AR Aging Report | 0-30 / 30-60 / 60-90 / >90 ngày — Xuất Excel, gửi email CEO thứ Hai |
| Credit Hold tự động | KH vượt Credit Limit → Flag `CREDIT_HOLD`, SO mới bị Block tự động |
| Bad Debt Write-off | Ghi nhận nợ khó đòi với Approval Workflow (cần CEO duyệt) |

---

## 3. COGS & Margin Tracking (Giá Vốn Thực)

Đây là điểm khác biệt của Wine ERP so với phần mềm kế toán thông thường:

```
Khi SO Line xuất kho:
  COGS = StockLot.unit_landed_cost × qty_shipped
  
  Landed Cost bao gồm:
    CIF giá mua
    + Thuế Nhập Khẩu (EVFTA/MFN)
    + Thuế TTĐB (35% hoặc 65% theo ABV)
    + VAT nhập khẩu (10%)  
    + Phí logistics nội địa (prorate theo thùng)
```

- **Gross Margin per SO Line:** `(Unit Price - Unit Landed Cost) / Unit Price × 100%`
- **CEO thấy Margin thực** — Tránh ảo giác "bán nhiều nhưng lỗ" vì không tính đủ thuế
- Margin Alert: Cảnh báo nếu dòng SO có margin âm (bán dưới giá vốn)

---

## 4. Journal Entries — Bút Toán Kép (Double-Entry)

Hệ thống tự động sinh bút toán kép cho mọi giao dịch:

| Sự kiện | Debit | Credit |
|---|---|---|
| Nhập kho (GR) | 156 - Hàng hóa | 331 - Phải trả NCC |
| Xuất kho bán (DO) | 632 - COGS | 156 - Hàng hóa |
| Xuất hóa đơn (AR Invoice) | 131 - Phải thu KH | 511 - Doanh thu |
| Thu tiền KH | 111/112 - Tiền | 131 - Phải thu KH |
| Thanh toán NCC | 331 - Phải trả NCC | 111/112 - Tiền |

- Bút toán được group theo `AccountingPeriod` (Kỳ kế toán tháng)
- **Period Closing:** Sau khi đóng tháng → Không sửa được bất kỳ chứng từ nào của tháng đó (Back-date prevention)

---

## 5. Legal Declarations — Tờ Khai Pháp Lý (Xuất Excel)

Vì công ty đang dùng Excel — Tất cả tờ khai xuất ra file Excel chuẩn để nộp/import vào phần mềm thuế:

### A. Tờ Khai Thuế Nhập Khẩu (Customs Declaration — Per Lô Hàng)
- Số tờ khai, ngày TQ, CIF, HS Code, Thuế NK, TTĐB, VAT từng dòng hàng
- Template Excel chuẩn Tổng cục Hải Quan
- Link đến AgencySubmission (tờ khai Agency đã upload PDF gốc)

### B. Tờ Khai Thuế TTĐB Tháng/Quý (SCT Declaration)
- Bảng kê hàng hóa chịu TTĐB đầu vào (Nhập khẩu) và đầu ra (Bán ra nội địa)
- Tự động tổng hợp từ PO (GR) và SO (DO) trong kỳ
- Xuất Excel theo biểu mẫu Bộ Tài Chính

### C. Bảng Kê VAT Tháng/Quý (VAT Report)
- Bảng kê hoá đơn mua vào (AP Invoices với VAT input)
- Bảng kê hoá đơn bán ra (AR Invoices với VAT output)
- Tự động tính VAT phải nộp = VAT output - VAT input

### D. Hóa Đơn Điện Tử (E-Invoice)
- Phát hành e-invoice cho KH sau khi SO delivered và confirmed
- Gửi email PDF hóa đơn cho KH tự động
- Lưu trữ trên Supabase Storage (giữ ít nhất 10 năm theo quy định)
- Tích hợp hệ thống hóa đơn điện tử *(Phase 2: kết nối provider như MISA Invoice, VIETTEL Invoice)*

---

## 6. Quản Lý Tem Rượu Nhập Khẩu (Wine Stamp Management)

> Sản phẩm Rượu nhập khẩu bắt buộc dán tem do Bộ Tài Chính (Tổng cục Hải quan) cấp. Việc quản lý phôi tem và báo cáo sử dụng tem mang tính pháp lý cao.

### A. Quy trình Mua Tem (Puchase)
- Kế toán đăng ký mua tem theo đợt từ cơ quan Thuế/Hải quan. Phân loại tem theo 2 độ cồn: `< 20 độ` và `>= 20 độ`.
- Hệ thống tiếp nhận lô tem (Record: `WineStampPurchase`) với Ký hiệu tem (VD: AA/20P) và dải Series Đầu - Cuối (`serialStart` - `serialEnd`).
- Tự động ghi nhận tổng lượng tem tồn kho để dễ dàng quản trị.

### B. Theo dõi dán tem (Usage & Allocation)
- Khi lô hàng cập cảng hoặc thông quan, việc dán tem diễn ra (thuộc nhóm nghiệp vụ Kho WMS hoặc Agency AGN).
- Hệ thống ghi nhận số lượng tem đã dán (`qtyUsed`) và dải Series tương ứng gắn liền vào một `Shipment` hoặc `StockLot` cụ thể.
- Tính năng ghi nhận tem hỏng, rách, mất (`qtyDamaged`) — bắt buộc xuất log biên bản hủy tem theo quy định.

### C. Báo cáo Tình Hình Sử Dụng Tem
- Hệ thống tự động trích xuất "Báo cáo Tình hình Sử dụng Tem Rượu Nhập khẩu" định kỳ Quý/Năm xuất ra Excel để Kế toán báo cáo Cơ quan Giám sát.
- Alert: Cảnh báo nếu số tem đã dán + số tem hỏng > Tổng số tem đã cấp phát.

---

## 7. Period End Close (Đóng Kỳ Kế Toán)

Quy trình cuối tháng:
1. Kế toán chạy **Pre-closing Checklist:** AR chưa thu hết? AP chưa hạch toán? Variance kho chưa duyệt?
2. Xuất tất cả báo cáo tháng (Excel)
3. CEO xác nhận
4. Click "Đóng Kỳ Tháng X" → Lock toàn bộ chứng từ của tháng
5. Tháng sau chỉ được làm việc với kỳ mới

---

## 7. Database Design (Tóm Lược)

```
AccountingPeriod  { year, month, is_closed }
JournalEntry      { entry_no, doc_type, doc_id, period_id, posted_at }
JournalLine       { entry_id, account, debit, credit }
ARInvoice         { invoice_no, so_id, customer_id, amount, due_date, status }
ARPayment         { invoice_id, amount, method, paid_at }
APInvoice         { invoice_no, po_id, supplier_id, amount, currency, due_date }
APPayment         { invoice_id, amount, method, paid_at }
TaxDeclaration    { type, period_year, period_month, status, file_url }
Expense           { category, amount, description, period_id, created_by }
CashPosition      { date, opening, collections, payments, closing, snapshot_at }
```

---

## 8. Báo Cáo Kết Quả Kinh Doanh (P&L Statement)

> Báo cáo quan trọng nhất — CEO xem hàng tháng để quyết định chiến lược.

### Cấu Trúc P&L

```
DOANH THU
  (+) Doanh thu bán hàng (từ AR Invoice)
  (-) Chiết khấu thương mại
  (-) Hàng bán bị trả lại
  ════════════════════════
  = DOANH THU THUẦN

GIẢM TRỪ GIÁ VỐN
  (-) Giá vốn hàng bán [COGS = Landed Cost × Qty]
  ════════════════════════
  = LỢI NHUẬN GỘP (Gross Profit)

CHI PHÍ HOẠT ĐỘNG
  (-) Chi phí logistics nội địa (bán hàng)
  (-) Chi phí nhân sự Sales & Marketing
  (-) Chi phí tổ chức sự kiện/tasting
  (-) Chi phí hư hỏng, write-off kho
  (-) Chi phí quản lý (Admin: văn phòng, thuê kho, IT...)
  ════════════════════════
  = LỢI NHUẬN HOẠT ĐỘNG (EBIT)

  (-) Chi phí lãi vay
  (+) Doanh thu tài chính (lãi tiền gửi)
  ════════════════════════
  = LỢI NHUẬN TRƯỚC THUẾ (EBT)

  (-) Thuế TNDN (20%)
  ════════════════════════
  = LỢI NHUẬN SAU THUẾ (Net Profit)
```

### Mức Độ Báo Cáo
- **Tháng:** Mặc định — CEO xem hàng tháng
- **Lũy kế YTD:** Jan → Hiện tại (Year-to-date)
- **So sánh:** Cùng kỳ năm ngoái / KPI kỳ

### Xuất Báo Cáo
- 📊 Export Excel (cho kế toán, kiểm toán)
- 📄 Export PDF (cho ngân hàng, đối tác)

---

## 9. Quản Lý Chi Phí (Expense Management)

Chi phí hoạt động không tự sinh từ giao dịch (như AP/AR) — Kế toán hoặc bộ phận nhập thủ công:

### Danh Mục Chi Phí
| Mã TK | Loại Chi Phí | Ví dụ |
|---|---|---|
| 641 | Chi phí bán hàng | Lương sales, commission, in ấn |
| 641.2 | Chi phí logistics bán hàng | Ship hàng đến khách |
| 641.3 | Chi phí marketing/events | Tasting event, wine fair |
| 642 | Chi phí quản lý | Lương admin, thuê VP, điện nước |
| 642.2 | Chi phí IT | Vercel hosting, Supabase, domain |
| 642.3 | Khấu hao TSCĐ | Xe, kệ kho, thiết bị kho |
| 635 | Chi phí tài chính | Lãi vay ngân hàng, phí LC |
| 811 | Chi phí khác | Write-off hàng hỏng |

### Nhập Chi Phí
- Kế toán nhập từng khoản với: Loại, Số tiền, Mô tả, Hóa đơn đính kèm (file)
- Phê duyệt: Chi phí lớn (>5 triệu) → Cần Manager/CEO duyệt
- Auto journal entry: Debit TK Chi phí / Credit TK Tiền hoặc Phải trả

---

## 10. Dòng Tiền & Vị Thế Thanh Khoản (Cash Flow)

> CEO cần biết: **"Tôi có bao nhiêu tiền thực trong tay? Tháng tới có đủ trả NCC không?"**

### Theo Dõi Tiền Mặt
- **Tiền trong tài khoản ngân hàng:** Kế toán cập nhật số dư ngân hàng hàng ngày (hoặc tích hợp Open Banking)
- **Tiền mặt quỹ:** Theo dõi riêng
- **Tổng Cash Position = Ngân hàng + Quỹ tiền mặt**

### Cash Forecast (30/60/90 ngày)

```
Hôm nay: ₫ 2,130,000,000

SẮP THU (AR đến hạn):
  + Park Hyatt (NET30 đến hạn 10/03) →  +₫  38,500,000
  + Rex Hotel (đến hạn 15/03)        →  +₫  22,000,000
  + Đại lý Miền Bắc (đến hạn 20/03) →  +₫ 180,000,000

SẮP PHẢi TRẢ:
  - Thuế NK lô MAEU12X3 (15/03)     →  -₫ 180,000,000
  - Thanh toán L/C Bordeaux (20/03)  →  -₫ 850,000,000
  - Lương tháng 3 (25/03)            →  -₫ 120,000,000
  - VAT tháng 02 (25/03)             →  -₫  95,000,000

DỰ BÁO CUỐI THÁNG: ₫ 1,125,500,000
```

🟡 Nếu dự báo < ngưỡng an toàn → Alert CEO sớm.

---

## 11. Báo Cáo Tài Chính Đầy Đủ (Financial Reports)

| Báo Cáo | Tần suất | Xuất |
|---|---|---|
| **P&L Statement** | Hàng tháng, YTD | Excel, PDF |
| **Cash Flow Statement** | Hàng tháng | Excel |
| **Balance Sheet (Bảng CĐKT)** | Hàng quý | Excel |
| **AR Aging Report** | Hàng tuần | Excel, Email |
| **AP Payment Schedule** | Hàng tuần | Excel |
| **COGS & Margin by SKU** | Theo yêu cầu | Excel |
| **COGS & Margin by Channel** | Hàng tháng | Excel |
| **Chi phí theo danh mục** | Hàng tháng | Excel |
| **Tờ khai Thuế NK** | Theo lô hàng | Excel chuẩn HQ |
| **Tờ khai Thuế TTĐB** | Hàng tháng/quý | Excel BTC |
| **Báo cáo VAT mua/bán** | Hàng tháng/quý | Excel BTC |

*Last updated: 2026-03-05 | Wine ERP v4.0*

---

## 12. Implementation Status (Trạng Thái Triển Khai)

> Cập nhật 05/03/2026 — **Hoàn thiện 75%**

### ✅ Đã triển khai

| Tính năng | File code | Ghi chú |
|---|---|---|
| AR Invoice + Payment | `finance/actions.ts`, `FinanceClient.tsx` | Tab AR, ghi thu, partial payment |
| AP Invoice + Payment | `finance/actions.ts`, `FinanceClient.tsx` | Tab AP, ghi trả |
| AR Aging Report | `FinanceClient.tsx` | Bar chart 4 bucket, Tab AR Aging |
| Finance KPI Cards | `FinanceClient.tsx` | 5 cards: AR, AR Overdue, AP, AP Overdue, Revenue |
| **Journal Entries** | `finance/actions.ts`, `FinanceTabs.tsx` | Tab "Sổ Nhật Ký" — auto từ GR/DO/Payment/Expense |
| **COGS Tracking** | `finance/actions.ts` | DR 632 / CR 156 khi DO confirm |
| **P&L Statement** | `FinanceTabs.tsx` | Tab P&L — Revenue, COGS, GP, Expenses, Net Profit |
| **Expense Management** | `FinanceTabs.tsx`, `schema.prisma` | Tab "Chi Phí" — CRUD + approval (>5M) + auto journal |
| **Period End Close** | `FinanceTabs.tsx`, `actions.ts` | Tab "Đóng Kỳ" — 5-item checklist + lock period |

### ❌ Chưa triển khai

| Tính năng | Ưu tiên |
|---|---|
| Cash Flow / Cash Position | 🟡 P2 |
| Balance Sheet (Bảng CĐKT) | 🟡 P2 |
| Credit Hold tự động | 🟡 P2 |
| Bad Debt Write-off | 🟡 P2 |
| Multi-currency AP | 🟡 P2 |
| Export Excel tất cả báo cáo | 🟡 P2 |
| E-Invoice integration | 🟢 P3 |
| Tờ khai TTĐB Excel | 🟡 P2 |
| Bảng kê VAT Excel | 🟡 P2 |

### Database Models (Prisma)

```
Expense           { expenseNo, category, account, amount, description, periodId, status, createdBy, approvedBy }
ExpenseCategory   enum: SALARY, RENT, UTILITIES, LOGISTICS, MARKETING, INSURANCE, BANK_FEE, OTHER
ExpenseStatus     enum: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED
JournalDocType    enum: ..., COGS, EXPENSE (added)
```

