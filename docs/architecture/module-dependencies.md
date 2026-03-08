# Module Dependencies — Wine ERP

## 1. Domain Ownership
Mỗi module đều có "chủ quyền" đối với các bảng nhất định trong cơ sở dữ liệu. 
**QUY TẮC CỐT LÕI (CHỐNG LỖI DOMINO):**
- **CHỈ ĐƯỢC PHÉP `CREATE`, `UPDATE`, `DELETE`** trên các bảng do chính module đó quản lý.
- **CÁC MODULE KHÁC CHỈ ĐƯỢC PHÉP `READ`** bảng đó. Hoặc phải gọi một Application API (Server Action) do module chủ sở hữu cung cấp nếu cần thay đổi dữ liệu.

| Module | Core Domain / Bảng Sở Hữu | Module Nào Phụ Thuộc (Chỉ Đọc) |
|---|---|---|
| **SYS** | User, Role, Department, Approval Flow | MDM, PRC, WMS, SLS, FIN (Đọc quyền & duyệt) |
| **MDM** | Product, Producer, Customer, Supplier, PriceList | PRC, WMS, SLS, CRM, CSG, TAX (Đọc Master Data) |
| **TAX** | TaxRate, MarketPrice | PRC (Tính năng Landed Cost), SLS (Suggest Giá) |
| **CNT** | Contract, ContractAmendment, RegulatedDocument, RegDocFile, RegDocAlert | PRC, SLS (Ràng buộc hợp đồng Mua/Bán), DSH (Compliance Warnings), MDM (Supplier/Product docs tab) |
| **PRC** | PurchaseOrder, PO Line, Shipment, Landed Cost | WMS (Tạo GR), FIN (Tạo AP Invoice) |
| **WMS** | Warehouse, Location, StockLot, GR, DO | SLS (Kiểm tra tồn kho), FIN (Giá vốn hàng bán - COGS) |
| **SLS** | SalesOrder, SO Line, Allocation Campaign/Quota | TRS (Giao hàng), FIN (Tạo AR Invoice), WMS (Xuất Kho) |
| **FIN** | ARInvoice, APInvoice, JournalEntry, Declarations | RPT (Báo cáo tài chính), DSH (Dashboards) |
| **STP** | WineStampPurchase, WineStampUsage | FIN (Báo cáo sử dụng tem), WMS (Kiểm tra tem khi xuất kho) |
| **TLG** | *(không có bảng DB riêng)* — API routes + lib | SLS, FIN, WMS, PRC, CRM (Đọc dữ liệu query cho CEO bot) |

## 2. Dependency Inversion Rules (Nguyên Tắc Trách Nhiệm)
- **Kế toán (FIN) TUYỆT ĐỐI KHÔNG SỬA Đơn Bán (SLS):** Nếu hóa đơn AR khác giá trị SO, FIN không được sửa SO. Phải có luồng (Write-off, Credit Note) từ SLS đổ sang FIN.
- **Bán hàng (SLS) TUYỆT ĐỐI KHÔNG TRỪ TỒN KHO (WMS):** SLS khi bán hàng không dùng đoạn code `prisma.stockLot.update({ qty_available: qty - 1 })`. Mọi tác động đến kho phải gọi hàm `pickByFIFO()` hoặc logic DO (Delivery Order) của `WMS`.
- **Nhập hàng (PRC) TUYỆT ĐỐI KHÔNG CỘNG TỒN KHO (WMS):** Nhập hàng từ Supplier xong, không tự động cộng `qty_received` vào kho. Phải để `WMS` thực hiện bước `Goods Receipt` (GR) đối chiếu hàng hóa rồi `WMS` tự kích hoạt Record Tồn.
- **Quản lý Tem (STP) CHỈ ĐƯỢC GHI NHẬN QUA `stamps/actions.ts`:** Các module khác (WMS, FIN) chỉ được ĐỌC dữ liệu tem. Mọi thao tác Tạo/Dán/Hủy tem phải gọi Server Action của STP (`createStampPurchase`, `recordStampUsage`).
- **Telegram Bot (TLG) CHỈ ĐỌC DỮ LIỆU:** Bot chỉ được phép `READ` (findMany, aggregate, groupBy) trên tất cả modules. Ngoại lệ duy nhất: `approvalRequest.update()` cho phép CEO duyệt/từ chối inline trên Telegram. Push notifications được gọi từ `lib/notifications.ts` (shared layer).

## 3. Tech Stack Dependencies
1. **Server Actions (`app/dashboard/*/actions.ts`)**: Lớp Business Logic chứa Prisma Commands. Gọi nhau nội bộ hoặc gọi qua client. Đừng tạo chéo server action file import lẫn lộn quá nhiều thay vào đó nên tách Shared Lib.
2. **Utils (`lib/*`)**: `tax-engine.ts`, `excel.ts`, `session.ts`. Lớp chung để giảm dependency chéo.
