# Consignment Management (Quản Lý Hàng Ký Gửi)

Trong mô hình kinh doanh Rượu Vang nhập khẩu, **hàng ký gửi (Consignment)** là nghiệp vụ cực kỳ phổ biến:
- Công ty đặt rượu **tại tủ rượu/kho của nhà hàng, khách sạn (HORECA)** nhưng hàng hóa đó **vẫn thuộc quyền sở hữu của công ty** cho đến khi khách hàng thực sự bán/tiêu thụ hết
- Khách hàng không phải trả tiền trước — chỉ thanh toán khi hàng đã bán ra

Đây là điểm **khác biệt then chốt** so với bán hàng thông thường và cần module riêng biệt.

---

## 1. Luồng Nghiệp Vụ Consignment (End-to-End)

```
[1] Công ty tạo Consignment Agreement với HORECA
         ↓
[2] Xuất Hàng Ký Gửi → Tồn kho TẠI ĐỊA ĐIỂM HORECA
(Hàng KHÔNG GIẢM khỏi Company Stock, chỉ CHUYỂN sang "Consigned Inventory")
         ↓
[3] HORECA bán cho khách lẻ
         ↓
[4] HORECA báo cáo kỳ (hàng tuần / hàng tháng): Đã bán X chai
         ↓
[5] Hệ thống ghi nhận Doanh Thu → Xuất Hóa đơn → Công nợ AR
    Tồn kho "Consigned" giảm đi X chai
         ↓
[6] Replenishment: Nếu tồn tại điểm < Min Stock → Hệ thống tự sinh đề xuất bổ sung hàng
```

---

## 2. Tính Năng Chính

### A. Quản Lý Hợp Đồng Ký Gửi (Consignment Agreement)
- Số hợp đồng, ngày ký, ngày hết hạn
- Điều khoản ký gửi: Công ty chịu phí giao hàng, phí lưu kho hay không?
- Kỳ Báo Cáo: HORECA báo cáo hàng tuần/tháng
- Cơ chế rút lại hàng (Reclaim): Nếu HORECA không bán được, hàng về kho công ty sau bao lâu?
- Tỷ lệ hoa hồng/chiết khấu đặc biệt cho kênh Consignment

### B. Tồn Kho Ký Gửi (Consigned Stock Tracking)
- Đây là loại tồn kho **Ngoài Doanh Nghiệp (Off-site Inventory)** — khác với **On-site Warehouse**
- Hệ thống phân tách rõ ràng:
  - `On-hand Stock` = Hàng thực tế trong kho của công ty
  - `Consigned Stock` = Hàng đang ký gửi tại các địa điểm HORECA
  - `Available to Promise (ATP)` = On-hand - Đã commit cho SO - Đã commit cho Consignment mới
- **Bản đồ Consignment:** Giao diện xem tất cả địa điểm đang có hàng ký gửi, số lượng tồn tại mỗi điểm

### C. Đối Chiếu Kỳ (Periodic Reconciliation)
- HORECA gửi báo cáo bán (Manual nhập hoặc Upload Excel) vào cuối kỳ
- Hệ thống tự đối chiếu: Tồn đầu kỳ + Xuất thêm - Tồn cuối kỳ = Số lượng đã bán
- Nếu có sai lệch (Variance) → Cảnh báo, yêu cầu HORECA giải thích (Bể, Hỏng, Mất?)
- Sau khi xác nhận số liệu bán → Tự động sinh Sales Invoice và cộng vào AR

### D. Kiểm Kê Thực Tế Định Kỳ (Physical Count tại HORECA)
- Lên lịch cho Sales Rep đến điểm HORECA kiểm kê thực tế
- So sánh kết quả kiểm kê vs Hệ thống → Điều chỉnh sai lệch có duyệt

---

## 3. Phân Biệt Vs Bán Hàng Thông Thường

| Tiêu chí | Bán Hàng (SO) | Ký Gửi (Consignment) |
|---|---|---|
| Quyền sở hữu | Chuyển ngay khi giao | Giữ cho đến khi khách bán được |
| Xuất hóa đơn | Ngay khi giao | Sau khi HORECA báo cáo đã bán |
| Thanh toán | Theo Payment Term của SO | Sau khi đã bán và xuất hóa đơn |
| Tồn kho | Giảm ngay | Chỉ dịch chuyển Loại tồn (On-hand → Consigned) |
| Rủi ro hàng hỏng | Thuộc về Khách hàng | Thường vẫn thuộc Công ty (cần ghi rõ HĐ) |

---

## 4. Database Design

- `ConsignmentAgreement`: Hợp đồng ký gửi với từng điểm HORECA
- `ConsignmentDelivery`: Lô hàng xuất ra điểm ký gửi (Chuyển từ On-hand → Consigned)
- `ConsignmentStock`: Snapshot tồn kho ký gửi theo điểm × SKU
- `ConsignmentReport`: Báo cáo HORECA gửi về (Đã bán bao nhiêu)
- `ConsignmentReconciliation`: Kết quả đối chiếu + Variance
- `ConsignmentInvoice`: Liên kết đến Invoice chính thức sau khi xác nhận bán

---

## 5. Implementation Status (Trạng Thái Triển Khai)

> Cập nhật 07/03/2026 — **Hoàn thiện 100%**

### ✅ Đã triển khai

| Tính năng | File code | Ghi chú |
|---|---|---|
| Agreement CRUD | `consignment/actions.ts` | Tạo, xem danh sách agreements |
| Consignment Stock | `addConsignmentStock`, `getConsignmentStocks` | Upsert stock per agreement × product |
| Sales Report | `createConsignmentReport` | HORECA báo cáo bán kỳ |
| Confirm Report → AR | `confirmConsignmentReport` | Xác nhận → Auto tạo AR Invoice CSG-INV-xxx |
| **Consigned Stock Map** | `getConsignedStockMap` | Bản đồ tồn kho ký gửi per Customer × SKU |
| **Replenishment Alerts** | `getReplenishmentAlerts` | Cảnh báo khi tồn < min stock (10 chai) |
| **Physical Count** | `createPhysicalCount` | Kiểm kê thực tế tại HORECA |
| **Confirm Count** | `confirmPhysicalCount` | Xác nhận kiểm kê → adjust qty + auto report |
| **Periodic Reconciliation** | `getPeriodicReconciliation` | ✨ **MỚI** — Tổng hợp per-customer: consigned, sold, remaining, variance, pending AR, overdue detection |
| Stats | `getConsignmentStats` | KPI: total agreements, active, stock sent, sold |

### Chi tiết Periodic Reconciliation

- Aggregates tất cả HORECA customers
- Tính estimated revenue = sold qty × latest price
- Tính pending AR per customer
- Overdue detection: WEEKLY > 7d, MONTHLY > 30d, QUARTERLY > 90d
- Summary: totalCustomers, totalConsigned, totalSold, totalPendingAR, overdueCount

*Last updated: 2026-03-07 | Wine ERP v5.0*
