# Data Flow & Business Constraints — Wine ERP

Tài liệu này là "Luật" khi lập trình các thao tác liên quan đến Cơ Sở Dữ Liệu (Constraints). Đảm bảo tính Toàn Vẹn Dữ Liệu và tránh Mâu Thuẫn (Data Inconsistency) khi các Module chéo nhau.

## 1. Luồng Mua Hàng & Inbound Flow (PRC ➔ WMS ➔ FIN)
**Luồng Logic:**
1. Thu mua (PRC) tạo `PurchaseOrder` (PO) ở trạng thái `APPROVED`.
2. Trưởng kho (WMS) nhận hàng vật lý, lập `GoodsReceipt` (GR).
   - *Constraint:* Khi `GR.status = CONFIRMED`, bảng `StockLot` sẽ tạo lô mới (cộng tồn khả dụng).
3. Kế toán (FIN) nhận bill của Supplier, lập `APInvoice` ghi Nợ.
   - *Constraint:* Số tiền `APInvoice` không được lớn hơn `PO Total` trừ khi có Phụ Phí (Landed Cost).

**Quy Tắc Ràng Buộc Cứng (Cấm Vi Phạm):**
- ❌ **KHÔNG ĐƯỢC HỦY HAY XÓA `PurchaseOrder`** nếu nó đã bị tham chiếu bởi `GoodsReceipt` đã CONFIRM hoặc có `APInvoice`. Cần check foreign key constrain trước!
- ❌ **KHÔNG ĐƯỢC XÓA Lô Hàng (`StockLot`)** nếu số lượng thực nhận (`qty_received`) > số lượng khả dụng (`qty_available`) - vì chứng tỏ mã này đã được xuất/sử dụng một phần.

## 2. Luồng Bán Hàng & Outbound Flow (SLS ➔ WMS ➔ FIN)
**Luồng Logic:**
1. Sales (SLS) lập `SalesOrder` (SO) có trạng thái `CONFIRMED`.
   - *Constraint:* SO không vượt quá `Credit Limit` của Khách hàng, không bán âm kho (`qty` phải <= `qty_available` trong bảng `StockLot`), có check Quota nếu là hàng `Allocation`.
2. Trưởng kho (WMS) nhận yêu cầu giao hàng, lập `DeliveryOrder` (DO) (hoặc trực tiếp xử lý).
   - *Constraint:* Tồn kho bị trừ DỰ TRỮ (Reserved) khi DO `PICKING` và bị CẮT (Consumed) khi DO `SHIPPED`. WMS sử dụng FIFO Strategy để chọn Lô cận date rớt hàng trước.
3. Kế toán (FIN) lập hóa đơn `ARInvoice` đòi tiền.
   - *Constraint:* Chỉ khi hàng đến nơi an toàn (`Delivered`).

**Quy Tắc Ràng Buộc Cứng (Cấm Vi Phạm):**
- ❌ **KHÔNG ĐƯỢC HỦY/SỬA GIAO DỊCH SO/SO_LINE** một khi SO đã chuyển trạng thái `DELIVERED` hoặc `INVOICED`.
- ❌ **TỪ CHỐI TẠO SO** nếu Khách có trạng thái `CREDIT_HOLD` hoặc giá bán thấp hơn Giá Xuất Xưởng tối thiểu (`calculateMinSellPrice()`).

## 3. Master Data Constraints (MDM)
Mọi dữ liệu cốt lõi thuộc Product, Customer, Supplier đều áp dụng chiến lược **Soft Delete**.
- ❌ **NGHIÊM CẤM Hard Delete (`prisma.customer.delete()`, `prisma.product.delete()`, `prisma.supplier.delete()`).**
  - **Lý do:** Record kế toán ARInvoice, SalesOrder lưu trữ ID. Hard delete sẽ bẻ gãy Database Relationships và làm gãy Component hiển thị tên Cty/Khách hàng.
  - **Cách làm đúng:** Cập nhật cột `status` thành `INACTIVE` hoặc gán thời gian vào `deleted_at`.

## 4. Landed Cost & Inventory Valuation Constraints (CST)
Landed cost Engine (Tính giá vốn thực tế) là lõi cực quan trọng của Kế toán & Kinh doanh.
- Để thay đổi Giá Vốn (`unit_landed_cost`) của 1 lô (`StockLot`), phải thông qua phân bổ Container (`LandedCostCampaign`).
- Mọi chênh lệch kiểm kê chu kỳ sinh ra `StockCountSession` đều phải được Duyệt (Approved) rồi mới điều chỉnh `qty_available` bằng module kiểm kê bù trừ. Module khác cấm gán cứng giá trị vào DB.

## 5. Quản Lý Tem Rượu (Wine Stamp Constraints) (FIN ➔ WMS)
Tem rượu nhập khẩu do Cơ quan Thuế/BCT cấp phát mang tính pháp lý rất cao.
- **Luồng nhận tem:** FIN đăng ký và ghi nhận tổng lượng Tem đã mua (`WineStampPurchase`).
- **Luồng dán tem:** Khi hàng về (`WMS` nhận GR) hoặc thông quan (`PRC/AGN`), người dùng ghi nhận số Tem đã dán (`WineStampUsage`).
**Quy Tắc Ràng Buộc Cứng:**
- ❌ **KHÔNG ĐƯỢC DÁN LỐ TEM:** Tổng số tem sử dụng (`qtyUsed` + `qtyDamaged`) của một dải tem KHÔNG BAO GIỜ được vượt quá `totalQty` đã mua. Phải dùng Transaction khi trừ tồn kho tem.
- ❌ **KHÔNG ĐƯỢC BÁN HÀNG CHƯA DÁN TEM:** `SalesOrder` phải kiểm tra các sản phẩm có ABV cao bắt buộc phải liên kết với lô hàng (`StockLot`) đã ghi nhận `WineStampUsage`.

---
🚨 **Nếu Dapp Agent đang viết logic CRUD hoặc State Machine, PHẢI kiểm tra các Constraints này để thêm logic `throw new Error()` vào đầu Function tương ứng nếu đầu vào/tháng thái sai phạm lệch!**
