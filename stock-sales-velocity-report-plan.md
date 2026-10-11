# Kế hoạch Triển khai: Báo Cáo Quản Trị Tồn Kho & Nhịp Độ Bán Hàng (Stock & Sales Velocity Report)

> **Mục tiêu:** Xây dựng màn hình/tab báo cáo chuyên sâu trong phân hệ Báo cáo (`/dashboard/reports`), tái hiện và nâng cấp toàn diện file `LY's Cellars - Stock Report.xlsx`. Kết hợp dữ liệu quá khứ (trước T8/2026) từ file Excel và dữ liệu thời gian thực từ ERP (từ T8/2026 trở đi).

---

## 1. Yêu cầu Nghiệp vụ & Quyết định Thiết kế

| Hạng mục | Quyết định thống nhất |
|---|---|
| **Vị trí tích hợp** | Tab thứ 4 trong trang `/dashboard/reports` mang tên **"Tồn kho & Nhịp độ bán" (Stock & Sales Velocity)** |
| **Nguồn dữ liệu quá khứ** | Import vào bảng CSDL `historical_monthly_sales` (từ T01/2023 đến T07/2026), có hỗ trợ nút Upload/Đồng bộ lại file Excel |
| **Nguồn dữ liệu hiện tại** | Truy vấn realtime từ ERP: Đơn bán `sales_orders` + `sales_order_lines` (từ T08/2026 trở đi) |
| **Dữ liệu tồn kho** | Tính chi tiết theo các kho thực tế: Kho Thường Tín (`WH-TA-TT`), Giang Văn Minh (`WH-TA-GVM`), Ký gửi/Showroom (`WH-LYS-SR`) và Tổng tồn |
| **Nhịp độ bán TB (Average Sales)** | Linh hoạt chọn chu kỳ tính (3 tháng, 6 tháng, 12 tháng gần nhất hoặc tùy chọn dải tháng). Mặc định tính theo 6 tháng gần nhất |
| **Số tháng bán hàng (Stock of Month)** | Công thức: `Tổng tồn kho / Sản lượng bán TB tháng`. Phân loại cảnh báo trực quan: <br>- Đỏ: Nguy cơ thiếu (< 2 tháng)<br>- Xanh lá: Tối ưu / An toàn (2 - 6 tháng)<br>- Xanh lam: Dồi dào (6 - 12 tháng)<br>- Vàng hổ phách: Tồn đọng (> 12 tháng) |
| **Thu gọn dữ liệu cũ (Collapsible)** | Mặc định **Thu gọn (Collapsed)** các cột tháng cũ (2023 - 07/2026) thành 1 cột tổng số bán lịch sử. Có nút chuyển đổi `[+] Mở rộng chi tiết quá khứ` để bung toàn bộ từng tháng khi cần đối soát sâu |
| **Tách biệt Sales vs Tasting** | Cột Sales dùng để tính nhịp độ tiêu thụ. Cột Tasting/Break/Damage hiển thị riêng để kiểm soát hao hụt |
| **Xuất Excel** | Tích hợp nút xuất file Excel tổng hợp giữ nguyên định dạng chuyên nghiệp như file Stock Report gốc |

---

## 2. Kiến trúc Kỹ thuật

### 2.1. CSDL (Prisma Schema)
Thêm model `HistoricalMonthlySales` vào `prisma/schema.prisma`:
```prisma
model HistoricalMonthlySales {
  id          String   @id @default(cuid())
  skuCode     String
  productName String?
  month       String   // Định dạng: "YYYY-MM", ví dụ: "2023-01", "2026-07"
  salesQty    Decimal  @default(0) // Số lượng bán thương mại
  tastingQty  Decimal  @default(0) // Số lượng tasting/hỏng vỡ/mẫu
  source      String?  @default("EXCEL_STOCK_REPORT")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([skuCode, month])
  @@index([skuCode])
  @@index([month])
  @@map("historical_monthly_sales")
}
```
*Lưu ý: Tăng tổng số Prisma model từ 146 -> 147, đồng bộ toàn bộ tài liệu theo DOCS SYNC PROTOCOL.*

### 2.2. Backend Data Engine (`actions-stock-velocity.ts`)
- `importHistoricalStockReport(bufferOrPath)`: Đọc và upsert dữ liệu từ file Excel vào bảng `historical_monthly_sales`.
- `getStockVelocityReport(options)`:
  - Lấy danh mục sản phẩm active kèm phân loại, nhà sản xuất.
  - Tổng hợp tồn kho thực tế từ `stock_lots` phân bổ theo từng kho (Thường Tín, Giang Văn Minh, Showroom/Ký gửi).
  - Lấy chuỗi bán hàng lịch sử từ `historical_monthly_sales`.
  - Lấy chuỗi bán hàng hiện tại từ `sales_order_lines` (kết hợp `sales_orders` có trạng thái khác `CANCELLED`).
  - Hợp nhất dữ liệu, tính toán TB bán, Stock of Month, Runout risk status.
- `exportStockVelocityExcel(data)`: Sinh file Excel báo cáo tổng hợp.

### 2.3. Frontend Component (`StockVelocityReport.tsx`)
- Tích hợp vào `ReportsClient.tsx` dưới dạng Tab:
  ```tsx
  { key: 'velocity', label: isEn ? 'Stock & Sales Velocity' : 'Tồn kho & Nhịp độ bán', icon: TrendingUp }
  ```
- Tính năng giao diện:
  - **KPI Header**: Tổng tồn kho toàn hệ thống (chai), Số SKU có nguy cơ thiếu hàng (<2 tháng), Số SKU tồn đọng (>12 tháng), Tổng sản lượng bán tháng gần nhất.
  - **Control Bar**:
    - Bộ lọc chu kỳ tính TB bán (3M, 6M, 12M).
    - Bộ lọc tình trạng tồn kho (Tất cả, Cần nhập gấp, Tối ưu, Tồn nhiều, Hết hàng).
    - Nút toggle: `Thu gọn / Mở rộng lịch sử quá khứ (2023 - 07/2026)`.
    - Nút toggle: `Hiện / Ẩn cột Tasting & Hao hụt`.
    - Tìm kiếm nhanh theo SKU / Tên rượu.
    - Nút `Xuất Excel` & Nút `Đồng bộ lại file lịch sử`.
  - **Sticky Table**:
    - Cột cố định trái: `Mã SKU`, `Tên rượu`, `Niên vụ`, `Tổng tồn kho`, `TB bán tháng`, `Số tháng bán (Badge màu)`.
    - Cột cuộn ngang:
      - Chi tiết tồn theo kho (`Thường Tín`, `G.V.Minh`, `Ký gửi`).
      - Cột tổng lịch sử (khi thu gọn) HOẶC từng cột tháng chi tiết từ Jan.23 đến nay (khi mở rộng).
      - Cột hàng sắp về (PO, ETA, Số lượng).

---

## 3. Lộ trình Thực hiện (Task Breakdown)

- [ ] **Giai đoạn 1: Database & Migration**
  - [ ] Cập nhật `prisma/schema.prisma` với model `HistoricalMonthlySales`.
  - [ ] Chạy `prisma db push` / `prisma generate`.
  - [ ] Tạo script migration / import tự động từ `scratch/test_updated_stock_report.xlsx`.
- [ ] **Giai đoạn 2: Server Actions & Data Processing**
  - [ ] Viết `src/app/dashboard/reports/actions-stock-velocity.ts` tổng hợp dữ liệu tồn kho + đơn bán ERP + lịch sử CSDL.
  - [ ] Viết hàm xuất Excel với định dạng và công thức chuẩn.
- [ ] **Giai đoạn 3: UI Component & UX Optimization**
  - [ ] Tạo component `StockVelocityReport.tsx` với đầy đủ chế độ thu gọn/mở rộng dữ liệu cũ, sticky columns, color badges.
  - [ ] Tích hợp Tab vào `ReportsClient.tsx`.
  - [ ] Cập nhật từ điển đa ngữ `i18n.ts`.
- [ ] **Giai đoạn 4: Kiểm thử & Đồng bộ Tài liệu**
  - [ ] Chạy test kiểm tra số liệu khớp 100% với file Stock Report và dữ liệu bán ERP.
  - [ ] Cập nhật `CODEBASE.md`, `docs/README.md`, `docs/llms.txt`, `docs/architecture/database-schema.md`, `docs/modules/reporting-bi.md`.
