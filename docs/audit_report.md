# Báo cáo Audit Logic Nghiệp vụ & An toàn Dữ liệu — Wine ERP

Tài liệu này tổng hợp toàn bộ các phát hiện lỗi logic nghiệp vụ, vi phạm ràng buộc dữ liệu, lỗi bảo mật, nguy cơ bất đồng bộ dữ liệu giữa các module chéo (Sales, WMS, Logistics, Finance, Tax, Stamps, Declarations, Procurement, Costing, Suppliers) của dự án Wine ERP.

---

## Tóm tắt các phát hiện (Summary of Findings)

| ID | Phase / Module | Tiêu đề phát hiện | Độ nghiêm trọng | Trạng thái |
|---|---|---|---|---|
| **AUDIT-WMS-01** | Phase 2: Warehouse | Lỗi thiếu trường bắt buộc `ownerEntityId` khi tạo `StockLot` | **Critical** | Chưa sửa |
| **AUDIT-WMS-02** | Phase 2: Warehouse | Rò rỉ tồn kho khi tạo lô ở trạng thái `DRAFT` của Goods Receipt | **Critical** | Chưa sửa |
| **AUDIT-WMS-03** | Phase 2: Warehouse | Không sử dụng Transaction khi cập nhật tồn kho chuyển kho | **Critical** | Chưa sửa |
| **AUDIT-WMS-04** | Phase 2: Warehouse | Không kiểm tra tồn khả dụng dẫn đến âm kho trong Delivery Order | **High** | Chưa sửa |
| **AUDIT-WMS-05** | Phase 2: Warehouse | Xác nhận trùng lặp đơn nhập/xuất gây nhân đôi bút toán tài chính | **High** | Chưa sửa |
| **AUDIT-WMS-06** | Phase 2: Warehouse | Thuật toán sinh mã `lotNo` tự tăng bị lỗi sắp xếp và trùng mã | **High/Medium** | Chưa sửa |
| **AUDIT-WMS-07** | Phase 2: Warehouse | Nhập kho chuyển nhận sai giá trị vốn do lấy sai Lot | **High/Medium** | Chưa sửa |
| **AUDIT-WMS-08** | Phase 2: Warehouse | Lỗi điều chỉnh kiểm kho khi hàng đã hết (`qtyAvailable = 0`) | **Medium** | Chưa sửa |
| **AUDIT-FIN-01** | Phase 3: Finance | Lỗi gọi bất đồng bộ bút toán kế toán ngoài transaction gây lệch sổ | **Critical** | Chưa sửa |
| **AUDIT-STM-01** | Phase 3: Stamps | Race Condition trong cập nhật số lượng tem rượu đã dán | **Critical** | Chưa sửa |
| **AUDIT-TAX-01** | Phase 3: Tax | Công thức tìm thuế suất dựa trên HS Code 4 chữ số không chính xác | **High** | Chưa sửa |
| **AUDIT-TAX-02** | Phase 3: Tax | Hardcode thuế suất TTĐB (SCT) bỏ qua cấu hình cơ sở dữ liệu | **Medium** | Chưa sửa |
| **AUDIT-FIN-02** | Phase 3: Finance | Đồng bộ COD sang ARInvoice nằm ngoài transaction gây sai lệch hóa đơn | **High/Medium** | Chưa sửa |
| **AUDIT-DEC-01** | Phase 3: Declarations | Thiếu cơ chế phân quyền và kiểm soát chuyển đổi trạng thái tờ khai | **High** | Chưa sửa |
| **AUDIT-DEC-02** | Phase 3: Declarations | Thiếu trường pháp nhân (`legalEntityId`) phân tách tờ khai thuế | **Critical** | Chưa sửa |
| **AUDIT-DEC-03** | Phase 3: Declarations | Lỗi logic lọc dữ liệu VAT theo thời gian hệ thống thay vì ngày hóa đơn | **High** | Chưa sửa |
| **AUDIT-DEC-04** | Phase 3: Declarations | Khai thiếu thuế TTĐB đầu vào do lọc bỏ lô hàng đã tiêu thụ | **Critical** | Chưa sửa |
| **AUDIT-DEC-05** | Phase 3: Declarations | Lọc PO khai báo Hải quan theo ngày tạo PO thay vì ngày mở tờ khai | **High** | Chưa sửa |
| **AUDIT-DEC-06** | Phase 3: Declarations | So sánh HS Code chính xác làm mất thuế nhập khẩu của sản phẩm | **High** | Chưa sửa |
| **AUDIT-DEC-07** | Phase 3: Declarations | Tính sai trị giá tính thuế hải quan CIF do thiếu phí vận chuyển/bảo hiểm | **High** | Chưa sửa |
| **AUDIT-DEC-08** | Phase 3: Declarations | Lỗi logic cập nhật doanh thu thuế đầu ra theo `updatedAt` của SO | **Critical** | Chưa sửa |
| **AUDIT-DEC-09** | Phase 3: Declarations | Sai công thức tính thuế TTĐB đầu ra và cơ chế khấu trừ đầu vào | **Critical** | Chưa sửa |
| **AUDIT-PRC-01** | Phase 4: Procurement | Trùng mã đơn mua hàng PO do Race Condition trong hàm `count` | **Critical** | Chưa sửa |
| **AUDIT-PRC-02** | Phase 4: Procurement | Thiếu kiểm tra ràng buộc khi hủy đơn hàng PO đã nhận hàng/có hóa đơn | **High** | Chưa sửa |
| **AUDIT-PRC-03** | Phase 4: Procurement | Bỏ qua kiểm tra ràng buộc giá hợp đồng khi nhập PO từ Excel | **High** | Chưa sửa |
| **AUDIT-CST-01** | Phase 4: Costing | Giá vốn trung bình bị đưa về 0 khi hết hàng tồn kho khả dụng | **Medium** | Chưa sửa |
| **AUDIT-CST-02** | Phase 4: Costing | Tính sai giá vốn (Landed Cost) do phân bổ cả thuế VAT nhập khẩu | **Critical** | Chưa sửa |
| **AUDIT-CST-03** | Phase 4: Costing | Phân bổ thuế nhập khẩu/TTĐB cào bằng theo số lượng chai gây sai giá vốn | **Critical** | Chưa sửa |
| **AUDIT-CST-04** | Phase 4: Costing | Không điều chỉnh giá vốn hàng bán (COGS) cho lượng hàng đã xuất trong kỳ | **High** | Chưa sửa |
| **AUDIT-SUP-01** | Phase 4: Suppliers | Lỗi hiệu năng N+1 query nghiêm trọng khi tải danh sách sản phẩm nhà cung cấp | **High** | Chưa sửa |
| **AUDIT-SUP-02** | Phase 4: Suppliers | Thiếu transaction khi tạo/cập nhật nhà cung cấp gây lỗi dữ liệu mồ côi | **Medium** | Chưa sửa |
| **AUDIT-SUP-03** | Phase 4: Suppliers | Thiếu kiểm tra công nợ AP còn treo trước khi vô hiệu hóa nhà cung cấp | **Medium** | Chưa sửa |
| **AUDIT-SUP-04** | Phase 4: Suppliers | Bug logic đánh giá nhà cung cấp: lấy tổng khiếu nại của hệ thống | **High** | Chưa sửa |
| **AUDIT-MDM-01** | Phase 5: Master Data | Bỏ qua xác thực (`requireAuth`) và phân quyền (`requirePermission`) trong sản phẩm và khách hàng | **Critical** | Chưa sửa |
| **AUDIT-MDM-02** | Phase 5: Master Data | Cập nhật sản phẩm & khách hàng không qua Zod schema validation | **High** | Chưa sửa |
| **AUDIT-MDM-03** | Phase 5: Master Data | Lỗi logic toán tử `??` làm mất khả năng xóa/set rỗng (`null`) các trường dữ liệu | **High/Medium** | Chưa sửa |
| **AUDIT-MDM-04** | Phase 5: Master Data | Thiếu transaction khi tạo/cập nhật khách hàng gây dữ liệu mồ côi | **Medium** | Chưa sửa |
| **AUDIT-POS-01** | Phase 5: POS | Toàn bộ chức năng POS, ca bán hàng và điểm thưởng không yêu cầu đăng nhập | **Critical** | Chưa sửa |
| **AUDIT-POS-02** | Phase 5: POS | Tính sai điểm tích lũy khách hàng (`getLoyaltyInfo`) do giới hạn chỉ lấy 50 dòng | **Critical** | Chưa sửa |
| **AUDIT-POS-03** | Phase 5: POS | Race condition trừ kho FIFO trong giao dịch POS do thiếu Row Locking | **Critical** | Chưa sửa |
| **AUDIT-POS-04** | Phase 5: POS | Lỗ hổng đổi điểm thưởng nhiều lần song song (Race Condition / TOCTOU) | **High** | Chưa sửa |
| **AUDIT-POS-05** | Phase 5: POS | Logic quản lý ca bán hàng không lưu DB và tính doanh thu sai lệch | **High** | Chưa sửa |
| **AUDIT-POS-06** | Phase 5: POS | Race condition sinh số đơn hàng `soNo` trong processPOSSale | **High** | Chưa sửa |
| **AUDIT-POS-07** | Phase 5: POS | Hardcode công thức tính thuế GTGT đầu ra mặc định chia 11 | **Medium** | Chưa sửa |
| **AUDIT-SYS-01** | Phase 6: Core Engines | Bỏ qua đăng nhập/phân quyền trong thiết lập hệ thống và ma trận duyệt | **Critical** | Chưa sửa |
| **AUDIT-SYS-02** | Phase 6: Core Engines | Lưu mật khẩu người dùng dạng plaintext không băm mật khẩu | **Critical** | Chưa sửa |
| **AUDIT-SYS-03** | Phase 6: Core Engines | Lỗ hổng mạo danh người duyệt (Approver Impersonation) trong processApproval | **Critical** | Chưa sửa |
| **AUDIT-SYS-04** | Phase 6: Core Engines | Cơ chế duyệt theo ngưỡng (Threshold) bị hỏng khi chạy thực tế | **High** | Chưa sửa |
| **AUDIT-SYS-05** | Phase 6: Core Engines | Middleware bỏ qua kiểm tra khi chạy dev mode và không thực sự chặn RBAC | **Critical** | Chưa sửa |

---

## Chi tiết các phát hiện & Giải pháp khắc phục

### Phase 2: Warehouse Operations & Logistics (WMS)

#### AUDIT-WMS-01: Lỗi thiếu trường bắt buộc `ownerEntityId` khi tạo `StockLot`
- **Mức độ:** **Critical (Runtime Crash)**
- **File ảnh hưởng:** 
  - `warehouse/actions-gr.ts` (hàm `createGoodsReceipt`)
  - `transfers/actions.ts` (hàm `transferStock`)
  - `warehouse/actions.ts` (hàm `moveToQuarantine`)
- **Mô tả:** Khi tạo bản ghi `StockLot` mới, hệ thống không truyền trường `ownerEntityId`. Trong [schema.prisma](file:///d:/Lyruou/wine-erp/prisma/schema.prisma), trường này được định nghĩa là bắt buộc (non-nullable) để phục vụ mô hình đa pháp nhân (Thắng Ân / Lys). Việc thiếu trường này gây lỗi crash truy vấn DB ở môi trường runtime.
- **Giải pháp:** Truyền `ownerEntityId` tương ứng với pháp nhân sở hữu kho hàng từ đơn nhập kho (`GoodsReceipt`) hoặc đơn chuyển kho (`StockTransfer`).

#### AUDIT-WMS-02: Rò rỉ tồn kho khi tạo lô ở trạng thái `DRAFT` của Goods Receipt
- **Mức độ:** **Critical (Inventory Leak / Ghost Stock)**
- **File ảnh hưởng:** [warehouse/actions-gr.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/warehouse/actions-gr.ts) (hàm `createGoodsReceipt`)
- **Mô tả:** Khi người dùng tạo một Goods Receipt nháp (`status: 'DRAFT'`), hệ thống đã tạo bản ghi `StockLot` ở trạng thái `AVAILABLE` ngay lập tức với số lượng `qtyAvailable > 0`. Điều này cho phép hệ thống xuất hoặc bán khống số hàng này dù thực tế hàng chưa về và chưa được xác nhận thực nhập.
- **Giải pháp:** Chỉ tạo `StockLot` hoặc đặt trạng thái của lô là `AVAILABLE` khi `GoodsReceipt` được chuyển sang trạng thái `CONFIRMED`. Đối với trạng thái `DRAFT`, lô hàng phải ở trạng thái tạm giữ hoặc không tạo lô.

#### AUDIT-WMS-03: Không sử dụng Transaction khi cập nhật tồn kho chuyển kho
- **Mức độ:** **Critical (Inventory Inconsistency)**
- **File ảnh hưởng:** [transfers/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/transfers/actions.ts) (hàm `advanceTransferStatus`)
- **Mô tả:** Khi chuyển trạng thái chuyển kho sang `CONFIRMED`, hệ thống thực hiện trừ tồn kho từng dòng hàng tuần tự trong vòng lặp `for...of` bằng các lệnh độc lập ngoài `$transaction`. Nếu một dòng bị lỗi do thiếu tồn khả dụng, các dòng trước đó đã bị trừ tồn sẽ không được rollback, gây thất thoát tồn kho nghiêm trọng. Tương tự đối với logic nhận hàng (`RECEIVED`) khi tạo các Lot mới ngoài transaction.
- **Giải pháp:** Đưa toàn bộ vòng lặp cập nhật tồn kho, ghi nhận nhật ký và tạo lô hàng vào trong một `prisma.$transaction`.

#### AUDIT-WMS-04: Không kiểm tra tồn khả dụng dẫn đến âm kho trong Delivery Order
- **Mức độ:** **High (Negative Inventory)**
- **File ảnh hưởng:** [warehouse/actions-do.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/warehouse/actions-do.ts) (hàm `createDeliveryOrder`)
- **Mô tả:** Hệ thống thực hiện trừ trực tiếp tồn kho khả dụng `qtyAvailable` thông qua toán tử `decrement` của Prisma mà không kiểm tra số lượng tồn kho khả dụng hiện tại trong DB có đủ lớn hơn hoặc bằng lượng yêu cầu xuất hay không. Điều này dẫn đến tồn kho bị âm nếu có tranh chấp dữ liệu (Race Condition).
- **Giải pháp:** Thêm kiểm tra số lượng tồn khả dụng trước khi trừ, hoặc thêm điều kiện `where: { qtyAvailable: { gte: qtyRequired } }` trong câu lệnh `update` của Prisma để DB từ chối giao dịch nếu không đủ hàng.

#### AUDIT-WMS-05: Xác nhận trùng lặp đơn nhập/xuất gây nhân đôi bút toán tài chính
- **Mức độ:** **High (Double Confirmation / Accounting Corruption)**
- **File ảnh hưởng:**
  - [warehouse/actions-gr.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/warehouse/actions-gr.ts)
  - [warehouse/actions-do.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/warehouse/actions-do.ts)
- **Mô tả:** Hệ thống không kiểm tra trạng thái hiện tại của đơn hàng trước khi cho phép xác nhận (`CONFIRM` hoặc `SHIP`). Một đơn đã được xác nhận trước đó vẫn có thể bị xác nhận lại, dẫn đến việc kích hoạt lại các tiến trình kế toán tài chính bất đồng bộ, gây nhân đôi bút toán (Double Journal Entry) và sai lệch báo cáo tài chính.
- **Giải pháp:** Kiểm tra nghiêm ngặt `status === 'DRAFT'` trước khi tiến hành xác nhận đơn nhập kho hoặc xuất kho.

#### AUDIT-WMS-06: Thuật toán sinh mã `lotNo` tự tăng bị lỗi sắp xếp và trùng mã
- **Mức độ:** **High/Medium (Lot Code Collision)**
- **File ảnh hưởng:** [warehouse/actions-gr.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/warehouse/actions-gr.ts)
- **Mô tả:** Thuật toán tìm mã Lot lớn nhất để tăng số tự động dùng `findFirst` sắp xếp `orderBy: { lotNo: 'desc' }` dạng chuỗi (String). Điều này gây lỗi sắp xếp bảng chữ cái (như "LOT-9" đứng sau "LOT-10"). Ngoài ra, hệ thống không lọc theo tiền tố `LOT-`, dẫn đến việc lấy nhầm mã của chuyển kho `TRF-` hoặc cách ly `QRT-` (do chữ T, Q đứng sau chữ L), gây lỗi sequence và trùng mã Lot.
- **Giải pháp:** Sử dụng regex hoặc lọc `where: { lotNo: { startsWith: 'LOT-' } }` và thực hiện parse số thứ tự riêng biệt để tìm mã số lớn nhất thực sự.

#### AUDIT-WMS-07: Nhập kho chuyển nhận sai giá trị vốn do lấy sai Lot
- **Mức độ:** **High/Medium (Valuation Distortion)**
- **File ảnh hưởng:** [transfers/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/transfers/actions.ts)
- **Mô tả:** Khi nhận hàng chuyển kho, hệ thống gom toàn bộ sản phẩm nhận được vào một Lot mới và lấy giá vốn của Lot cũ nhất ở kho xuất (`take: 1`), gây sai lệch nghiêm trọng về giá trị tồn kho ở kho nhận nếu kho xuất có nhiều Lot với giá vốn khác nhau.
- **Giải pháp:** Thực hiện chuyển kho theo cơ chế giữ nguyên định danh Lot cũ hoặc phân tách số lượng chuyển theo từng Lot gốc để bảo toàn giá trị vốn (Landed Cost).

#### AUDIT-WMS-08: Lỗi điều chỉnh kiểm kho khi hàng đã hết (`qtyAvailable = 0`)
- **Mức độ:** **Medium (Cycle Count Defect)**
- **File ảnh hưởng:** [stock-count/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/stock-count/actions.ts) (hàm `adjustStockFromCount`)
- **Mô tả:** Hàm `adjustStockFromCount` chỉ tìm kiếm các lô hàng có `qtyAvailable > 0` để điều chỉnh chênh lệch. Đối với sản phẩm đã hết hàng trong hệ thống (tồn kho khả dụng bằng 0) nhưng khi kiểm thực tế lại phát hiện dư, hệ thống không thể tìm thấy lô nào để cộng tồn, dẫn đến thất bại. Đồng thời, việc điều chỉnh chênh lệch này không sinh bút toán điều chỉnh tài sản (632 hoặc 711).
- **Giải pháp:** Cho phép tạo lô mới nếu kiểm kê phát hiện thừa hàng và không tìm thấy lô cũ, đồng thời gọi module tài chính để sinh bút toán chênh lệch tài sản tương ứng.

---

### Phase 3: Finance, Wine Stamps & Tax

#### AUDIT-FIN-01: Lỗi gọi bất đồng bộ bút toán kế toán ngoài transaction gây lệch sổ
- **Mức độ:** **Critical (Financial Discrepancy)**
- **File ảnh hưởng:**
  - [warehouse/actions-gr.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/warehouse/actions-gr.ts)
  - [warehouse/actions-do.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/warehouse/actions-do.ts)
  - [finance/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/finance/actions.ts)
- **Mô tả:** Các hàm sinh bút toán kế toán tự động (Giá vốn, Doanh thu, Thanh toán, Xóa nợ) được gọi bất đồng bộ bằng cách chạy song song hoặc dùng `.catch(() => {})` để bỏ qua lỗi. Nếu DB bị khóa hoặc kỳ kế toán đã đóng làm việc tạo bút toán bị thất bại, nghiệp vụ kho vẫn hoàn thành nhưng bút toán tài chính không được ghi nhận, gây lệch sổ sách nghiêm trọng giữa kho và kế toán.
- **Giải pháp:** Đưa việc sinh bút toán vào chung transaction với nghiệp vụ kho. Nếu tạo bút toán thất bại, toàn bộ giao dịch kho phải bị rollback.

#### AUDIT-STM-01: Race Condition trong cập nhật số lượng tem rượu đã dán
- **Mức độ:** **Critical (Race Condition in Stamps)**
- **File ảnh hưởng:** [stamps/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/stamps/actions.ts) (hàm `recordStampUsage`)
- **Mô tả:** Hàm `recordStampUsage` thực hiện đọc số lượng tem đã dùng ngoài transaction (`purchase.usedQty`), sau đó cộng thêm số lượng dán mới (`qtyUsed + qtyDamaged`) rồi lưu đè lên bằng lệnh `update`. Khi có nhiều thủ kho ghi nhận dán tem song song, việc ghi đè này gây ra Race Condition mất mát dữ liệu và dẫn đến việc dán lố số lượng tem thực tế đã mua.
- **Giải pháp:** Sử dụng câu lệnh cập nhật nguyên tử của Prisma: `usedQty: { increment: qtyUsed + qtyDamaged }` kết hợp kiểm tra điều kiện ràng buộc ở mức cơ sở dữ liệu.

#### AUDIT-TAX-01: Công thức tìm thuế suất dựa trên HS Code 4 chữ số không chính xác
- **Mức độ:** **High (Inaccurate Tax Engine)**
- **File ảnh hưởng:** [tax/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/tax/actions.ts) (hàm `calculateTaxEngine`)
- **Mô tả:** Hàm `calculateTaxEngine` chỉ so sánh 4 ký tự đầu của HS Code để tìm thuế suất tương ứng (`contains: hsCode.substring(0, 4)`). Phân loại thuế suất nhập khẩu thực tế của rượu vang và rượu mạnh phụ thuộc chi tiết vào mã HS 8 chữ số (các mã con trong nhóm 2204 có thuế suất khác biệt lớn). Việc so sánh này gây tính sai thuế suất nghiêm trọng.
- **Giải pháp:** Thực hiện tìm kiếm khớp chính xác mã HS 8 chữ số, nếu không thấy mới tìm ngược lên các nhóm cha (6 số, 4 số) theo cấp bậc (hierarchical search).

#### AUDIT-TAX-02: Hardcode thuế suất TTĐB (SCT) bỏ qua cấu hình cơ sở dữ liệu
- **Mức độ:** **Medium (Hardcoded Tax Rate)**
- **File ảnh hưởng:** [tax/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/tax/actions.ts)
- **Mô tả:** Thuế suất TTĐB (SCT) bị hardcode cứng trong code backend (35% và 65%) dựa trên độ cồn ABV của sản phẩm, hoàn toàn bỏ qua trường cấu hình `sctRate` được khai báo trong bảng `TaxRate` của DB. Điều này khiến hệ thống không thể cập nhật thuế suất linh hoạt khi chính sách thuế thay đổi.
- **Giải pháp:** Sử dụng giá trị `sctRate` từ bảng `TaxRate` được cấu hình trong DB thay vì hardcode.

#### AUDIT-FIN-02: Đồng bộ COD sang ARInvoice nằm ngoài transaction gây sai lệch hóa đơn
- **Mức độ:** **High/Medium (COD Sync Failure)**
- **File ảnh hưởng:** [finance/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/finance/actions.ts)
- **Mô tả:** Tiến trình đồng bộ tiền thu hộ COD sang hóa đơn Phải thu (AR Invoice) không được thực hiện trong transaction. Logic tự động lấy hóa đơn AR mới nhất chưa thanh toán để phân bổ tiền thu hộ có nguy cơ phân bổ nhầm đối tượng hóa đơn của khách hàng khác nếu có nhiều giao dịch xảy ra đồng thời.
- **Giải pháp:** Sử dụng khóa bản ghi (Row Locking / Transaction) và đối chiếu chính xác mã SO/DO liên kết với hóa đơn AR.

#### AUDIT-DEC-01: Thiếu cơ chế phân quyền và kiểm soát chuyển đổi trạng thái tờ khai
- **Mức độ:** **High**
- **File ảnh hưởng:** [declarations/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/declarations/actions.ts) (hàm `updateDeclarationStatus`, `uploadTaxDocument`, `signTaxDeclaration`)
- **Mô tả:** Các hàm cập nhật trạng thái tờ khai, tải lên tài liệu đính kèm và ký duyệt tờ khai hoàn toàn không có cơ chế phân quyền người dùng (Role-based Access Control - RBAC). Bất kỳ người dùng nào có quyền truy cập endpoint đều có thể phê duyệt hoặc thay đổi tài liệu tờ khai. Ngoài ra, hàm `updateDeclarationStatus` cho phép chuyển trạng thái tự do (ví dụ chuyển ngược từ `SUBMITTED` về `DRAFT`), điều này vi phạm tính bất biến của chứng từ thuế sau khi đã nộp.
- **Giải pháp:** Kiểm tra quyền của người dùng (chỉ cho phép kế toán thuế/giám đốc tài chính ký duyệt) và áp dụng máy trạng thái (State Machine) chặt chẽ cho trạng thái tờ khai: `DRAFT` -> `APPROVED` -> `SUBMITTED` (cấm chuyển ngược trạng thái khi đã nộp).

#### AUDIT-DEC-02: Thiếu trường pháp nhân (`legalEntityId`) phân tách tờ khai thuế
- **Mức độ:** **Critical (Data Inconsistency)**
- **File ảnh hưởng:** [declarations/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/declarations/actions.ts) (hàm `createDeclaration`)
- **Mô tả:** Hệ thống ERP được thiết kế đa pháp nhân (Thắng Ân và Lys) dùng chung cơ sở dữ liệu. Tuy nhiên, bảng `taxDeclaration` và hàm `createDeclaration` hoàn toàn không lưu thông tin pháp nhân `legalEntityId`. Điều này dẫn đến việc trộn lẫn các tờ khai thuế giữa hai công ty, khiến dữ liệu báo cáo thuế mất tính chính xác và không thể phân loại theo từng thực thể pháp lý.
- **Giải pháp:** Thêm trường `legalEntityId` vào bảng `TaxDeclaration` và yêu cầu truyền pháp nhân cụ thể khi tạo tờ khai thuế.

#### AUDIT-DEC-03: Lỗi logic lọc dữ liệu VAT theo thời gian hệ thống thay vì ngày hóa đơn
- **Mức độ:** **High**
- **File ảnh hưởng:** [declarations/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/declarations/actions.ts) (hàm `getDeclarationData`)
- **Mô tả:** Khi lấy dữ liệu hóa đơn VAT đầu ra cho tờ khai thuế, hệ thống lọc theo `createdAt` (ngày tạo record trong cơ sở dữ liệu). Trong nghiệp vụ kế toán, việc kê khai thuế phải căn cứ vào Ngày hóa đơn thực tế (`invoiceDate`). Nếu hóa đơn của tháng 4 được kế toán nhập vào hệ thống vào ngày 1 tháng 5, bộ lọc `createdAt` sẽ kéo hóa đơn này sang tờ khai thuế tháng 5, gây sai lệch báo cáo thuế và vi phạm quy định kê khai thuế của cơ quan Nhà nước.
- **Giải pháp:** Lọc hóa đơn dựa trên trường ngày hóa đơn (`invoiceDate`) hoặc ngày phát hành thực tế thay vì `createdAt`.

#### AUDIT-DEC-04: Khai thiếu thuế TTĐB đầu vào do lọc bỏ lô hàng đã tiêu thụ
- **Mức độ:** **Critical (Tax Inaccuracy / Legal Risk)**
- **File ảnh hưởng:** [declarations/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/declarations/actions.ts) (hàm `getDeclarationData`)
- **Mô tả:** Để tính toán dữ liệu thuế TTĐB (SCT) đầu vào trong kỳ, hệ thống truy vấn các `StockLot` và loại trừ các lô có trạng thái `CONSUMED` (`status: { not: 'CONSUMED' }`). Điều này là sai lầm nghiêm trọng về mặt kế toán thuế. Thuế TTĐB đầu vào của hàng nhập khẩu được xác định tại thời điểm nhập khẩu (khi nhập kho, bất kể lô hàng đó đã bán hay chưa). Việc lọc bỏ các lô đã bán (`CONSUMED`) làm biến mất toàn bộ các lô hàng bán chạy trong kỳ khỏi báo cáo thuế đầu vào, dẫn đến khai thiếu nghiêm trọng số thuế TTĐB đầu vào được ghi nhận.
- **Giải pháp:** Bỏ điều kiện lọc `status: { not: 'CONSUMED' }`. Chỉ cần lọc các `StockLot` có ngày thực nhận `receivedDate` nằm trong kỳ báo cáo.

#### AUDIT-DEC-05: Lọc PO khai báo Hải quan theo ngày tạo PO thay vì ngày mở tờ khai
- **Mức độ:** **High**
- **File ảnh hưởng:** [declarations/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/declarations/actions.ts) (hàm `getImportCustomsData`)
- **Mô tả:** Hàm `getImportCustomsData` lấy dữ liệu hải quan từ các PO có `createdAt` nằm trong kỳ báo cáo. Trong thực tế, thuế nhập khẩu và thủ tục hải quan căn cứ vào Ngày mở tờ khai hải quan (Customs Declaration Date) chứ không phải ngày tạo Purchase Order. Một PO có thể được tạo từ tháng 3 nhưng tháng 5 hàng mới về cảng và mở tờ khai. Lọc theo `createdAt` của PO sẽ làm sai lệch nghiêm trọng kỳ báo cáo thuế hải quan.
- **Giải pháp:** Thêm trường ngày mở tờ khai hải quan (`customsDeclarationDate` hoặc `declarationDate`) vào đơn mua hàng (`PurchaseOrder`) và thực hiện lọc báo cáo hải quan theo trường này.

#### AUDIT-DEC-06: So sánh HS Code chính xác làm mất thuế nhập khẩu của sản phẩm
- **Mức độ:** **High**
- **File ảnh hưởng:** [declarations/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/declarations/actions.ts) (hàm `getImportCustomsData`)
- **Mô tả:** Hệ thống thực hiện so sánh chính xác mã HS giữa sản phẩm và bảng thuế suất (`taxRates.find(t => t.hsCode === hsCode)`). Tuy nhiên, bảng `TaxRate` trong DB thường lưu mã HS dạng nhóm (4 số hoặc 6 số), trong khi sản phẩm lưu mã HS chi tiết (8 số). Phép so sánh chính xác (`===`) sẽ bị thất bại hoàn toàn đối với hầu hết các sản phẩm, dẫn đến hệ thống rơi vào nhánh mặc định (thuế nhập khẩu bằng 0%, sctRate = 35%, vatRate = 10%). Điều này làm mất toàn bộ thuế nhập khẩu thực tế (thường từ 45%-50% đối với rượu vang).
- **Giải pháp:** Thực hiện tìm kiếm khớp theo tiền tố mã HS (Ví dụ: So sánh 4 số đầu, 6 số đầu tương tự như `calculateTaxEngine`).

#### AUDIT-DEC-07: Tính sai trị giá tính thuế hải quan CIF do thiếu phí vận chuyển/bảo hiểm
- **Mức độ:** **High**
- **File ảnh hưởng:** [declarations/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/declarations/actions.ts) (hàm `getImportCustomsData`)
- **Mô tả:** Trị giá tính thuế CIF được tính bằng công thức: `cifValue = qty * unitPrice * exchangeRate`. Công thức này chỉ đúng nếu đơn giá PO (`unitPrice`) là giá CIF. Nếu PO ký với nhà cung cấp nước ngoài theo điều kiện FOB hoặc EXW (rất phổ biến), trị giá tính thuế hải quan bắt buộc phải cộng thêm chi phí vận chuyển quốc tế (Freight) và phí bảo hiểm (Insurance). Việc bỏ qua các chi phí này dẫn đến việc khai thiếu giá trị hải quan, vi phạm luật thuế nhập khẩu (hành vi trốn thuế vô ý).
- **Giải pháp:** Bổ sung các trường chi phí Freight và Insurance vào Purchase Order và thực hiện phân bổ các chi phí này vào trị giá tính thuế CIF của từng dòng sản phẩm.

#### AUDIT-DEC-08: Lỗi logic cập nhật doanh thu thuế đầu ra theo `updatedAt` của SO
- **Mức độ:** **Critical (Double Taxation / Missing Revenue)**
- **File ảnh hưởng:** [declarations/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/declarations/actions.ts) (hàm `getSCTDetailedReport`)
- **Mô tả:** Hàm `getSCTDetailedReport` truy vấn doanh thu bán ra từ các dòng `SalesOrderLine` của đơn hàng SO có trạng thái hoàn thành và có ngày cập nhật `so.updatedAt` nằm trong kỳ báo cáo. Logic này cực kỳ lỗi vì `updatedAt` thay đổi mỗi khi đơn hàng được cập nhật (ví dụ: chuyển từ đã giao sang đã thanh toán). Nếu SO giao vào tháng 4 (đã khai thuế đầu ra tháng 4), sang tháng 5 khách hàng thanh toán và SO cập nhật trạng thái thành `PAID`, `updatedAt` chuyển sang tháng 5. Khi đó, đơn hàng này sẽ bị kéo vào tờ khai tháng 5 một lần nữa, dẫn đến việc kê khai trùng lặp doanh thu bán ra và nhân đôi số thuế đầu ra phải nộp.
- **Giải pháp:** Kê khai doanh thu và thuế đầu ra dựa trên Ngày hóa đơn tài chính (`invoiceDate`) hoặc Ngày xuất kho thực tế (`deliveredDate` / `shippedDate`) thay vì `updatedAt`.

#### AUDIT-DEC-09: Sai công thức tính thuế TTĐB đầu ra và cơ chế khấu trừ đầu vào
- **Mức độ:** **Critical (Tax Inaccuracy / Legal Compliance)**
- **File ảnh hưởng:** [declarations/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/declarations/actions.ts) (hàm `getSCTDetailedReport`)
- **Mô tả:** 
  1. *Sai công thức tính thuế TTĐB đầu ra:* Hệ thống tính thuế TTĐB đầu ra bằng công thức: `sct = revenue * sctRate`. Theo luật thuế TTĐB Việt Nam, giá tính thuế TTĐB là giá bán chưa có thuế GTGT và chưa có thuế TTĐB. Công thức đúng phải là: `Giá tính thuế TTĐB = Giá bán chưa thuế GTGT / (1 + Thuế suất TTĐB)`. Việc nhân trực tiếp thuế suất vào doanh thu (revenue) gây tính dư thuế nghiêm trọng.
  2. *Sai cơ chế khấu trừ thuế TTĐB đầu vào:* Hàm tính số thuế phải nộp bằng cách lấy tổng thuế đầu ra trừ đi toàn bộ thuế đầu vào của các lô nhập kho trong kỳ (`netSCTPayable = outputSummary.totalSCT - inputSummary.totalSCT`). Theo luật, doanh nghiệp chỉ được khấu trừ số thuế TTĐB đầu vào tương ứng với số lượng hàng hóa nhập khẩu **đã thực tế bán ra** trong kỳ. Việc trừ toàn bộ đầu vào nhập trong kỳ là sai nguyên tắc khấu trừ thuế TTĐB.
- **Giải pháp:**
  1. Điều chỉnh công thức tính thuế TTĐB đầu ra: `sct = (revenue / (1 + sctRate)) * sctRate`.
  2. Thực hiện tính toán số thuế TTĐB đầu vào được khấu trừ dựa trên số lượng hàng thực tế bán ra của từng lô hàng, theo dõi chi tiết thuế TTĐB đầu vào đã khấu trừ của từng `StockLot`.

---

### Phase 4: Procurement, Costing & Suppliers

#### AUDIT-PRC-01: Trùng mã đơn mua hàng PO do Race Condition trong hàm `count`
- **Mức độ:** **Critical (Concurrency/Race Condition)**
- **File ảnh hưởng:**
  - [procurement/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/procurement/actions.ts) (hàm `createPurchaseOrder`, `importPOFromExcel`)
- **Mô tả:** Khi sinh số đơn mua hàng tự động (`poNo`), hệ thống thực hiện đếm tổng số lượng PO hiện tại: `const count = await prisma.purchaseOrder.count()`, sau đó cộng 1 để tạo số PO mới. Vì thao tác đếm và tạo PO không nằm trong một transaction cô lập (Isolation level Serializable) hoặc không dùng khóa, khi có 2 người dùng tạo PO hoặc import file Excel song song, cả hai sẽ nhận về cùng một số thứ tự, dẫn đến lỗi trùng lặp `poNo` và gây crash hệ thống do vi phạm ràng buộc unique key.
- **Giải pháp:** Sử dụng cơ chế cơ sở dữ liệu như Sequence (PostgreSQL) hoặc tìm mã PO lớn nhất trong ngày/tháng hiện tại bằng lock để sinh số tự động an toàn, hoặc dùng mã ngẫu nhiên UUID/CUID an toàn.

#### AUDIT-PRC-02: Thiếu kiểm tra ràng buộc khi hủy đơn hàng PO đã nhận hàng/có hóa đơn
- **Mức độ:** **High (Data Integrity)**
- **File ảnh hưởng:** [procurement/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/procurement/actions.ts) (hàm `updatePOStatus`)
- **Mô tả:** Hàm `updatePOStatus` cho phép chuyển trạng thái PO sang `CANCELLED` bất kỳ lúc nào nếu trạng thái hiện tại là `APPROVED`, `IN_TRANSIT` hoặc `PARTIALLY_RECEIVED`. Tuy nhiên, hệ thống hoàn toàn không kiểm tra xem PO đó đã được liên kết với Goods Receipt (đã nhập kho thực tế) hoặc AP Invoice (đã phát sinh hóa đơn nhà cung cấp) chưa. Việc hủy PO đã nhập kho một phần sẽ bẻ gãy mối quan hệ DB, gây ra các lô hàng không có PO tham chiếu và làm lệch số liệu kế toán công nợ/kho vận.
- **Giải pháp:** Trước khi cho phép hủy PO, phải kiểm tra xem có Goods Receipt ở trạng thái `CONFIRMED` hoặc bất kỳ AP Invoice nào đã được tạo hay chưa. Nếu có, cấm hủy đơn hàng và yêu cầu người dùng phải xử lý hoàn trả hàng/hủy hóa đơn trước.

#### AUDIT-PRC-03: Bỏ qua kiểm tra ràng buộc giá hợp đồng khi nhập PO từ Excel
- **Mức độ:** **High (Business Constraint Bypass)**
- **File ảnh hưởng:** [procurement/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/procurement/actions.ts) (hàm `importPOFromExcel`)
- **Mô tả:** Hàm `importPOFromExcel` có kiểm tra tính hợp lệ và trạng thái `ACTIVE` của hợp đồng (`contractId`). Tuy nhiên, hệ thống bỏ qua việc xác thực xem danh mục sản phẩm nhập và đơn giá (`unitPrice`) trong Excel có khớp với các điều khoản giá đã được ký kết trong hợp đồng hay không. Điều này cho phép nhân viên thu mua chỉnh sửa giá tùy ý trong file Excel và bypass toàn bộ cơ chế kiểm soát giá của hợp đồng.
- **Giải pháp:** Thực hiện đối chiếu sản phẩm và đơn giá trong file Excel nhập vào với dòng chi tiết hợp đồng tương ứng. Nếu đơn giá vượt quá hoặc không khớp với giá hợp đồng thỏa thuận, từ chối import và báo lỗi.

#### AUDIT-CST-01: Giá vốn trung bình bị đưa về 0 khi hết hàng tồn kho khả dụng
- **Mức độ:** **Medium (Valuation Defect)**
- **File ảnh hưởng:** [costing/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/costing/actions.ts) (hàm `getCostingProducts`)
- **Mô tả:** Để hiển thị giá vốn `unitLandedCost` của sản phẩm, hệ thống tính bình quân gia quyền của các lô hàng còn tồn kho khả dụng (`qtyAvailable > 0` và trạng thái `AVAILABLE`). Nếu một sản phẩm vừa bán hết hàng (tồn kho khả dụng bằng 0), giá vốn tính toán sẽ trả về 0. Điều này làm cho giao diện hiển thị sai lệch, và công cụ đề xuất giá gợi ý bán ra (`getPriceSuggestions`) sẽ đề xuất giá bán bằng 0 hoặc margin bị lỗi.
- **Giải pháp:** Nếu tồn kho hiện tại bằng 0, hệ thống phải tự động lấy giá vốn của lô hàng gần nhất đã nhập để làm giá vốn tham chiếu cho sản phẩm.

#### AUDIT-CST-02: Tính sai giá vốn (Landed Cost) do phân bổ cả thuế VAT nhập khẩu
- **Mức độ:** **Critical (Accounting Violation / Legal Risk)**
- **File ảnh hưởng:** [costing/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/costing/actions.ts) (hàm `calculateLandedCostProration`, `runSensitivityAnalysis`)
- **Mô tả:** Trong thuật toán phân bổ chi phí Landed Cost, hệ thống cộng toàn bộ các chi phí bao gồm: Thuế nhập khẩu, Thuế TTĐB (SCT), Chi phí khác và cả Thuế VAT nhập khẩu để phân bổ vào giá vốn hàng tồn kho (`unitLandedCost`). Theo luật kế toán Việt Nam (VAS 02) và quốc tế (IAS 2), Thuế VAT đầu vào của hàng nhập khẩu là loại thuế được khấu trừ trực tiếp (ghi nhận vào tài khoản phải thu thuế 133) nên nghiêm cấm tính vào giá trị hàng tồn kho. Việc cộng VAT vào giá vốn làm thổi phồng giá trị tài sản kho lên thêm 10%, nâng khống giá vốn hàng bán (COGS) khi xuất kho và làm sai lệch nghiêm trọng báo cáo tài chính P&L.
- **Giải pháp:** Loại bỏ `totalVat` ra khỏi tổng chi phí phân bổ giá vốn (`totalCost`) trong hàm `calculateLandedCostProration`. Chỉ sử dụng Thuế nhập khẩu, Thuế TTĐB và các chi phí dịch vụ/vận chuyển không được khấu trừ.

#### AUDIT-CST-03: Phân bổ thuế nhập khẩu/TTĐB cào bằng theo số lượng chai gây sai giá vốn
- **Mức độ:** **Critical (Financial Valuation Distortion)**
- **File ảnh hưởng:** [costing/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/costing/actions.ts) (hàm `calculateLandedCostProration`, `runSensitivityAnalysis`)
- **Mô tả:** Hệ thống phân bổ toàn bộ chi phí nhập khẩu (gồm cả Thuế nhập khẩu và Thuế TTĐB) cào bằng theo tỷ lệ Số lượng chai (`ratio = data.qty / totalQty`). Điều này cực kỳ phi lý đối với doanh nghiệp nhập khẩu rượu vang/rượu mạnh vì thuế nhập khẩu và thuế TTĐB được tính trực tiếp dựa trên trị giá hải quan CIF của từng loại sản phẩm.
  *Ví dụ:* Một container có 10 chai rượu cao cấp (500 USD/chai) và 100 chai rượu giá rẻ (10 USD/chai). Việc phân bổ theo số lượng khiến mỗi chai rượu chịu mức thuế nhập khẩu như nhau. Chai rượu 10 USD sẽ bị đội giá vốn lên gấp nhiều lần (gánh thuế hộ cho chai cao cấp), trong khi chai rượu 500 USD có giá vốn cực kỳ thấp. Điều này làm méo mó nghiêm trọng biên lợi nhuận của từng sản phẩm.
- **Giải pháp:** Thuế nhập khẩu và thuế TTĐB của sản phẩm nào phải được phân bổ trực tiếp dựa trên Trị giá tính thuế CIF của chính dòng sản phẩm đó (Value-based Allocation). Chỉ các chi phí chung như cước tàu, phí dịch vụ kho bãi mới được phân bổ theo Số lượng hoặc Thể tích.

#### AUDIT-CST-04: Không điều chỉnh giá vốn hàng bán (COGS) cho lượng hàng đã xuất trong kỳ
- **Mức độ:** **High (Accounting Discrepancy)**
- **File ảnh hưởng:** [costing/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/costing/actions.ts) (hàm `finalizeLandedCostCampaign`)
- **Mô tả:** Khi kết thúc chiến dịch Landed Cost, hệ thống cập nhật đơn giá vốn thực tế `unitLandedCost` vào toàn bộ `StockLot` tương ứng. Tuy nhiên, nếu lô hàng đó đã được xuất bán một phần hoặc toàn bộ trước khi chạy phân bổ giá vốn (rất phổ biến vì chi phí landed cost thường về chậm sau khi nhập kho), số lượng hàng đã xuất bán đã được ghi nhận giá vốn hàng bán (COGS) theo đơn giá tạm tính. Việc chỉ cập nhật `unitLandedCost` trong bảng `StockLot` sẽ chỉ thay đổi giá trị của hàng tồn kho khả dụng còn lại, hoàn toàn bỏ qua lượng hàng đã bán, dẫn đến sai lệch nghiêm trọng giữa sổ kho và sổ cái kế toán.
- **Giải pháp:** Trong hàm `finalizeLandedCostCampaign`, cần tính toán lượng hàng đã xuất của lô hàng đó, xác định chênh lệch giữa giá vốn tạm tính và giá vốn thực tế mới, và tự động tạo bút toán điều chỉnh giá vốn hàng bán (COGS Adjustment Entry) để phản ánh chính xác chi phí trên sổ sách kế toán.

#### AUDIT-SUP-01: Lỗi hiệu năng N+1 query nghiêm trọng khi tải danh sách sản phẩm nhà cung cấp
- **Mức độ:** **High (Performance Loop)**
- **File ảnh hưởng:** [suppliers/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/suppliers/actions.ts) (hàm `getSupplierProducts`)
- **Mô tả:** Trong hàm `getSupplierProducts`, hệ thống lấy danh sách dòng PO của nhà cung cấp. Sau đó, chạy một vòng lặp `for...of` qua từng PO line để thực hiện câu truy vấn `prisma.purchaseOrderLine.findMany` tìm kiếm `productId` một cách riêng lẻ. Nếu nhà cung cấp có hàng trăm đơn hàng, hệ thống sẽ thực hiện hàng trăm câu truy vấn DB độc lập, gây nghẽn băng thông cơ sở dữ liệu và tăng thời gian phản hồi API đáng kể.
- **Giải pháp:** Sử dụng một câu truy vấn gộp duy nhất để lấy toàn bộ dòng PO của nhà cung cấp: `await prisma.purchaseOrderLine.findMany({ where: { po: { supplierId } }, include: { product: true } })`, sau đó thực hiện aggregate trong bộ nhớ NodeJS.

#### AUDIT-SUP-02: Thiếu transaction khi tạo/cập nhật nhà cung cấp gây lỗi dữ liệu mồ côi
- **Mức độ:** **Medium (Data Integrity)**
- **File ảnh hưởng:** [suppliers/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/suppliers/actions.ts) (hàm `createSupplier`, `updateSupplier`)
- **Mô tả:** Hàm `createSupplier` thực hiện 3 câu lệnh ghi độc lập: tạo `supplier`, tạo `supplierContact` và tạo `supplierAddress` mà không bọc trong transaction. Nếu việc tạo thông tin liên lạc hoặc địa chỉ bị lỗi (ví dụ do lỗi DB hoặc validation trường địa chỉ), nhà cung cấp vẫn được tạo thành công nhưng không có thông tin liên lạc/địa chỉ mặc định. Điều này phá vỡ tính toàn vẹn dữ liệu và gây crash giao diện khi hệ thống cố hiển thị primary contact của nhà cung cấp đó.
- **Giải pháp:** Đưa toàn bộ các thao tác tạo/cập nhật thông tin liên quan đến nhà cung cấp vào trong một `prisma.$transaction`.

#### AUDIT-SUP-03: Thiếu kiểm tra công nợ AP còn treo trước khi vô hiệu hóa nhà cung cấp
- **Mức độ:** **Medium (Business Process Gap)**
- **File ảnh hưởng:** [suppliers/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/suppliers/actions.ts) (hàm `deleteSupplier`)
- **Mô tả:** Hàm `deleteSupplier` thực hiện vô hiệu hóa (soft-delete) nhà cung cấp và có kiểm tra xem có PO nào chưa hoàn tất không. Tuy nhiên, hệ thống không hề kiểm tra xem doanh nghiệp có đang treo khoản nợ phải trả (AP Invoice) nào chưa thanh toán với nhà cung cấp này không. Việc vô hiệu hóa nhà cung cấp khi còn nợ chưa trả sẽ gây khó khăn cho kế toán khi xử lý đối chiếu công nợ và thanh toán sau này.
- **Giải pháp:** Bổ sung kiểm tra số lượng AP Invoice của nhà cung cấp có trạng thái khác `PAID` hoặc `CANCELLED`. Nếu còn dư nợ, từ chối xóa/vô hiệu hóa nhà cung cấp cho đến khi công nợ được tất toán.

#### AUDIT-SUP-04: Bug logic đánh giá nhà cung cấp: lấy tổng khiếu nại của hệ thống
- **Mức độ:** **High (Critical Bug)**
- **File ảnh hưởng:** [suppliers/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/suppliers/actions.ts) (hàm `getSupplierScorecard`)
- **Mô tả:** Khi tính toán điểm chất lượng nhà cung cấp trong scorecard, hệ thống đếm số lượng khiếu nại chất lượng bằng câu lệnh: `const complaints = await prisma.complaintTicket.count({ where: { type: 'QUALITY' } })`. Câu lệnh này hoàn toàn thiếu điều kiện lọc theo `supplierId`. Kết quả là tổng số lượng khiếu nại chất lượng của toàn bộ hệ thống sẽ bị quy trách nhiệm cho từng nhà cung cấp riêng biệt, dẫn đến điểm đánh giá chất lượng và grade (xếp hạng) của tất cả các nhà cung cấp đều bị sai lệch hoàn toàn.
- **Giải pháp:** Thêm điều kiện lọc `supplierId` vào truy vấn: `const complaints = await prisma.complaintTicket.count({ where: { supplierId, type: 'QUALITY' } })`.

---

### Phase 5: Master Data & POS Operations

#### AUDIT-MDM-01: Bỏ qua xác thực (`requireAuth`) và phân quyền (`requirePermission`) trong sản phẩm và khách hàng
- **Mức độ:** **Critical (Authorization Bypass)**
- **File ảnh hưởng:** 
  - [products/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/products/actions.ts) (`updateProduct`, `deleteProduct`, `bulkImportProducts`, `createPriceList`, `upsertPriceListLine`, `deletePriceListLine`, `deletePriceList`, `uploadProductMedia`, `deleteProductMedia`, `setPrimaryMedia`, `addProductAward`, `deleteProductAward`, `uploadProductImage`, `deleteProductImage`)
  - [customers/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/customers/actions.ts) (`updateCustomer`, `deleteCustomer`, `bulkImportCustomers`, `createCustomerAddress`, `updateCustomerAddress`, `deleteCustomerAddress`)
- **Mô tả:** Trừ hàm tạo mới sản phẩm/khách hàng, tất cả các Server Actions ghi dữ liệu khác trong module Products và Customers đều không gọi `requireAuth()` hoặc `requirePermission()`. Bất kỳ người dùng nào có kết nối mạng (hoặc gọi trực tiếp từ client) đều có thể sửa đổi thông tin sản phẩm, xóa bảng giá, chỉnh sửa hạn mức nợ của khách hàng, hoặc tải lên ảnh trái phép mà không cần đăng nhập.
- **Giải pháp:** Bổ sung `await requireAuth()` và các hàm kiểm tra phân quyền cụ thể (ví dụ: `await requirePermission('MDM', 'WRITE')`) ở ngay đầu mỗi hàm Server Action có tác vụ ghi hoặc xóa dữ liệu.

#### AUDIT-MDM-02: Cập nhật sản phẩm & khách hàng không qua Zod schema validation
- **Mức độ:** **High (Validation Bypass)**
- **File ảnh hưởng:** 
  - [products/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/products/actions.ts) (`updateProduct`)
  - [customers/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/customers/actions.ts) (`updateCustomer`)
- **Mô tả:** Khác với hàm tạo (`createProduct`/`createCustomer`), các hàm cập nhật trực tiếp nhận input từ client và truyền vào Prisma `update` mà không gọi xác thực qua Zod Schema. Điều này cho phép bỏ qua hoàn toàn các quy tắc dữ liệu (ví dụ: SKU tối thiểu 3 ký tự, email khách hàng phải đúng định dạng, hạn mức tín dụng phải lớn hơn 0, v.v.), dẫn đến dữ liệu rác hoặc dữ liệu lỗi chui vào DB.
- **Giải pháp:** Sử dụng Zod Schema với phương thức `.partial()` hoặc `.pick()` để validate input trước khi thực hiện cập nhật DB. Ví dụ: `const data = productSchema.partial().parse(input)`.

#### AUDIT-MDM-03: Lỗi logic toán tử `??` làm mất khả năng xóa/set rỗng (`null`) các trường dữ liệu
- **Mức độ:** **High/Medium (Data Mutation Defect)**
- **File ảnh hưởng:** 
  - [products/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/products/actions.ts) (`updateProduct`)
  - [customers/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/customers/actions.ts) (`updateCustomer`)
- **Mô tả:** Trong các hàm cập nhật, việc map dữ liệu nullable sử dụng cú pháp `input.vintage ?? undefined` hoặc `customerData.shortName ?? undefined`. Khi người dùng muốn xóa thông tin cũ (ví dụ: đặt lại năm sản xuất vintage của sản phẩm về rỗng hoặc xóa tên viết tắt shortName của khách hàng) bằng cách truyền giá trị `null`, biểu thức sẽ trả về `undefined`. Prisma sẽ bỏ qua các trường có giá trị `undefined`, khiến các trường này giữ nguyên giá trị cũ trong DB và không bao giờ xóa được.
- **Giải pháp:** Thay đổi cú pháp map dữ liệu sang kiểm tra kiểu rõ ràng: `vintage: input.vintage !== undefined ? input.vintage : undefined` để cho phép truyền giá trị `null` xuống DB.

#### AUDIT-MDM-04: Thiếu transaction khi tạo/cập nhật khách hàng gây dữ liệu mồ côi
- **Mức độ:** **Medium (Data Integrity)**
- **File ảnh hưởng:** [customers/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/customers/actions.ts) (`createCustomer`, `updateCustomer`)
- **Mô tả:** Khi tạo mới hoặc cập nhật khách hàng kèm thông tin liên lạc (`CustomerContact`) và địa chỉ (`CustomerAddress`), hệ thống thực hiện các lệnh `create` độc lập tuần tự ngoài transaction. Nếu địa chỉ bị lỗi định dạng hoặc DB nghẽn lúc tạo Address/Contact, bản ghi khách hàng chính vẫn được tạo/cập nhật thành công nhưng thiếu hoàn toàn thông tin phụ trợ bắt buộc, dẫn đến lỗi mồ côi và crash giao diện khi hiển thị.
- **Giải pháp:** Bọc toàn bộ các thao tác tạo/cập nhật Customer, Contact, và Address liên quan vào trong một `prisma.$transaction`.

#### AUDIT-POS-01: Toàn bộ chức năng POS, ca bán hàng và điểm thưởng không yêu cầu đăng nhập
- **Mức độ:** **Critical (Authentication Bypass)**
- **File ảnh hưởng:** [pos/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/pos/actions.ts)
- **Mô tả:** Không một hàm nào trong file `pos/actions.ts` thực hiện kiểm tra `requireAuth()` hay kiểm tra quyền truy cập. Bất kỳ ai cũng có thể gọi các API Server Actions này để bán rượu trực tiếp tại showroom, trừ kho, xem doanh thu ca, đóng ca bán hàng, hoặc tự cộng điểm thưởng loyalty cho tài khoản của mình.
- **Giải pháp:** Thêm kiểm tra `await requireAuth()` và `await requirePermission('SLS', 'WRITE')` vào toàn bộ các tác vụ xử lý giao dịch, shift management và loyalty.

#### AUDIT-POS-02: Tính sai điểm tích lũy khách hàng (`getLoyaltyInfo`) do giới hạn chỉ lấy 50 dòng
- **Mức độ:** **Critical (Calculations Defect / Data Loss)**
- **File ảnh hưởng:** [pos/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/pos/actions.ts) (`getLoyaltyInfo`)
- **Mô tả:** Để tính toán số dư điểm hiện tại (`pointsBalance`) của khách hàng, hệ thống lấy lịch sử giao dịch điểm và cộng trừ trong JS. Tuy nhiên, truy vấn DB bị giới hạn cứng `take: 50` giao dịch gần nhất. Khi một khách hàng thân thiết có hơn 50 giao dịch tích điểm/tiêu điểm, các giao dịch cũ hơn 50 dòng trước đó bị bỏ qua, dẫn đến việc tính toán số dư điểm tích lũy bị sai lệch hoàn toàn so với thực tế.
- **Giải pháp:** Sử dụng hàm `prisma.loyaltyTransaction.aggregate({ _sum: { points: true } })` để tính tổng số dư điểm trực tiếp từ database thay vì truy vấn dữ liệu thô rồi tính toán thủ công trong JS.

#### AUDIT-POS-03: Race condition trừ kho FIFO trong giao dịch POS do thiếu Row Locking
- **Mức độ:** **Critical (Concurrency/Race Condition)**
- **File ảnh hưởng:** [pos/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/pos/actions.ts) (`processPOSSale`)
- **Mô tả:** Khi trừ kho theo cơ chế FIFO, hàm `processPOSSale` thực hiện truy vấn các `StockLot` khả dụng ngoài transaction, sau đó lặp và gửi lệnh cập nhật `decrement` vào DB. Khi hai quầy POS thanh toán đồng thời cho cùng một sản phẩm có tồn kho thấp, cả hai sẽ cùng đọc ra các lô hàng có tồn kho giống nhau và cùng thực hiện trừ kho song song. Prisma sẽ thực hiện trừ kho và có thể khiến trường tồn kho khả dụng `qtyAvailable` bị âm dưới 0, vi phạm ràng buộc tồn kho không âm của hệ thống.
- **Giải pháp:** Sử dụng cơ chế khóa dòng (Row Locking) bằng truy vấn raw SQL `SELECT ... FOR UPDATE` khi đọc danh sách `StockLot` trong transaction để đảm bảo các yêu cầu thanh toán được xếp hàng xử lý tuần tự.

#### AUDIT-POS-04: Lỗ hổng đổi điểm thưởng nhiều lần song song (Race Condition / TOCTOU)
- **Mức độ:** **High (Race Condition in Loyalty)**
- **File ảnh hưởng:** [pos/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/pos/actions.ts) (`redeemLoyaltyPoints`)
- **Mô tả:** Hàm `redeemLoyaltyPoints` đọc số dư điểm khả dụng bằng `getLoyaltyInfo` ngoài transaction, so sánh xem khách hàng có đủ điểm không, sau đó mới tạo một giao dịch trừ điểm. Đây là lỗ hổng Time of Check to Time of Use (TOCTOU). Nếu khách hàng cố tình gửi nhiều yêu cầu đổi điểm song song trong một phần nghìn giây, tất cả các yêu cầu sẽ đọc số dư điểm cũ, vượt qua điều kiện kiểm tra và thực hiện trừ điểm nhiều lần, khiến số dư điểm tích lũy bị âm và doanh nghiệp bị thất thoát tiền chiết khấu.
- **Giải pháp:** Thực hiện việc kiểm tra số dư điểm và ghi nhận giao dịch trừ điểm trong cùng một transaction cô lập (Isolation level Serializable hoặc Row Locking).

#### AUDIT-POS-05: Logic quản lý ca bán hàng không lưu DB và tính doanh thu sai lệch
- **Mức độ:** **High (Shift Management Defect)**
- **File ảnh hưởng:** [pos/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/pos/actions.ts) (`openShift`, `closeShift`)
- **Mô tả:**
  1. *Thiếu bảng lưu trữ:* Chức năng quản lý ca không lưu thông tin `Shift` vào DB mà chỉ sinh một mã `shiftId` ngẫu nhiên lưu trong log audit, khiến hệ thống không thể theo dõi ca thực tế và không lưu trữ được dữ liệu đối chiếu tiền mặt đầu/cuối ca.
  2. *Lỗi tính doanh thu:* Khi đóng ca (`closeShift`), hệ thống truy vấn toàn bộ Sales Order có tiền tố `POS-` được tạo trong ngày hôm đó để tính doanh thu. Nếu trong ngày có nhiều ca làm việc (ca sáng và ca chiều), ca chiều đóng sẽ kéo theo toàn bộ doanh thu của ca sáng để đối chiếu, gây sai lệch nghiêm trọng báo cáo chênh lệch tiền mặt.
- **Giải pháp:** Thêm bảng `POSShift` vào database để lưu trữ chính xác trạng thái ca, số tiền mở/đóng ca. Mỗi Sales Order tại POS khi tạo phải được liên kết với một `shiftId` cụ thể để tính doanh thu chính xác cho từng ca.

#### AUDIT-POS-06: Race condition sinh số đơn hàng `soNo` trong processPOSSale
- **Mức độ:** **High (Concurrency/Race Condition)**
- **File ảnh hưởng:** [pos/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/pos/actions.ts) (`processPOSSale`)
- **Mô tả:** Logic sinh số đơn hàng sử dụng `prisma.salesOrder.count()` ngoài transaction. Khi có nhiều đơn hàng POS được thanh toán đồng thời tại các quầy khác nhau, việc đếm sẽ trả về cùng một giá trị, sinh ra các số đơn hàng `soNo` trùng nhau (ví dụ: `POS-2605-0010`), dẫn đến crash DB do vi phạm khóa unique key.
- **Giải pháp:** Sử dụng Sequence của database hoặc tạo bộ đếm tập trung (Redis/Locking table) để sinh mã đơn hàng một cách tuần tự và an toàn.

#### AUDIT-POS-07: Hardcode công thức tính thuế GTGT đầu ra mặc định chia 11
- **Mức độ:** **Medium (Tax Engine Flaw)**
- **File ảnh hưởng:** [pos/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/pos/actions.ts) (`generatePOSVATInvoice`)
- **Mô tả:** Khi xuất hóa đơn VAT cho đơn hàng POS, hệ thống tính tiền thuế và tiền trước thuế bằng cách lấy tổng tiền chia cho 11 (mặc định thuế suất GTGT là 10% cho mọi sản phẩm). Điều này sai nghiệp vụ vì đối với các sản phẩm rượu nhập khẩu có thể có thuế suất khác hoặc chịu các loại chi phí khác không chịu thuế VAT.
- **Giải pháp:** Duyệt qua các dòng đơn hàng để tính toán thuế VAT dựa trên trường thuế suất `vatRate` thực tế cấu hình cho từng sản phẩm.

---

### Phase 6: Core Engines & RBAC Rules

#### AUDIT-SYS-01: Bỏ qua đăng nhập/phân quyền trong thiết lập hệ thống và ma trận duyệt
- **Mức độ:** **Critical (Authorization Bypass)**
- **File ảnh hưởng:**
  - [settings/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/settings/actions.ts) (tất cả các hàm ngoại trừ `createUser` chỉ có ghi log audit)
  - [settings/approval-matrix/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/settings/approval-matrix/actions.ts) (tất cả các hàm)
- **Mô tả:** Toàn bộ các Server Actions dùng để quản trị hệ thống như gán quyền cho role (`updateRolePermissions`), gán role cho user (`updateUserRoles`), thay đổi trạng thái user (`updateUser`), cập nhật ma trận duyệt của tờ trình (`saveAllRoutes`) hay cấu hình ngưỡng tiền duyệt của CEO (`saveAllThresholds`) đều không kiểm tra quyền của người gọi. Bất kỳ ai cũng có thể truy cập các API này để thay đổi cấu hình bảo mật hệ thống.
- **Giải pháp:** Bắt buộc áp dụng kiểm tra quyền quản trị tối cao ở đầu mỗi hàm: `await requirePermission('SYS', 'ADMIN')`.

#### AUDIT-SYS-02: Lưu mật khẩu người dùng dạng plaintext không băm mật khẩu
- **Mức độ:** **Critical (Security Vulnerability / Plaintext Passwords)**
- **File ảnh hưởng:** [settings/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/settings/actions.ts) (`createUser`)
- **Mô tả:** Khi tạo người dùng mới, hệ thống lưu trực tiếp trường `passwordHash` nhận từ client vào DB mà không thực hiện bất kỳ bước băm mật khẩu nào (như sử dụng bcrypt). Mật khẩu của toàn bộ nhân viên trong hệ thống bị lưu trữ dưới dạng thô (plaintext), tạo ra rủi ro bảo mật vô cùng lớn nếu DB bị rò rỉ hoặc người quản trị truy cập xem dữ liệu.
- **Giải pháp:** Sử dụng thư viện băm mật khẩu chuẩn (bcrypt hoặc argon2) ở phía backend trước khi lưu trường password vào database.

#### AUDIT-SYS-03: Lỗ hổng mạo danh người duyệt (Approver Impersonation) trong processApproval
- **Mức độ:** **Critical (Security Vulnerability / Privilege Escalation)**
- **File ảnh hưởng:** [settings/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/settings/actions.ts) (`processApproval`)
- **Mô tả:** Hàm duyệt tài liệu `processApproval` nhận tham số `approverId` trực tiếp từ client truyền lên, sau đó kiểm tra xem user đó có quyền duyệt bước hiện tại của tài liệu hay không. Tuy nhiên, hệ thống hoàn toàn không đối chiếu xem `approverId` đó có trùng với ID của người dùng hiện đang đăng nhập (session user) hay không. Bất kỳ người dùng thông thường nào cũng có thể truyền ID của CEO hoặc Trưởng phòng Tài chính vào tham số `approverId` để tự phê duyệt các đơn hàng của mình.
- **Giải pháp:** Loại bỏ tham số `approverId` khỏi input từ client. Lấy ID người duyệt trực tiếp từ thông tin phiên đăng nhập đã được xác thực: `const user = await requireAuth(); const approverId = user.id`.

#### AUDIT-SYS-04: Cơ chế duyệt theo ngưỡng (Threshold) bị hỏng khi chạy thực tế
- **Mức độ:** **High (Workflow Engine Defect)**
- **File ảnh hưởng:** [settings/actions.ts](file:///d:/Lyruou/wine-erp/src/app/dashboard/settings/actions.ts) (`submitForApproval`, `processApproval`)
- **Mô tả:**
  1. *Lỗi lọc bước:* Khi gửi duyệt (`submitForApproval`), hệ thống lọc ra các bước cần thiết dựa trên ngưỡng tiền (`applicableSteps`). Tuy nhiên, bản ghi `ApprovalRequest` tạo ra chỉ lưu trường `currentStep = 1` mà không lưu danh sách các bước đã lọc (`applicableSteps`).
  2. *Lỗi duyệt thực tế:* Khi thực hiện duyệt trong `processApproval`, hệ thống tìm định nghĩa bước bằng cách so sánh `currentStep` trực tiếp với mảng gốc `template.steps` (chứa đầy đủ toàn bộ các bước của template gốc, bao gồm cả những bước lẽ ra đã được lọc bỏ do dưới ngưỡng). Điều này khiến hệ thống vẫn bắt buộc tài liệu phải đi qua tất cả các cấp phê duyệt của template gốc, làm vô hiệu hóa hoàn toàn cơ chế định tuyến theo ngưỡng.
- **Giải pháp:** Lưu trữ mảng các bước duyệt thực tế được áp dụng cho yêu cầu (`applicableSteps`) vào một bảng liên kết (ví dụ: `ApprovalRequestStep`) khi gửi duyệt, và thực hiện duyệt dựa trên bảng liên kết này thay vì tham chiếu trực tiếp sang template gốc.

#### AUDIT-SYS-05: Middleware bỏ qua kiểm tra khi chạy dev mode và không thực sự chặn RBAC
- **Mức độ:** **Critical (Security Bypass / Middleware Defect)**
- **File ảnh hưởng:** [middleware.ts](file:///d:/Lyruou/wine-erp/src/middleware.ts)
- **Mô tả:**
  1. *Bỏ qua hoàn toàn trong dev mode:* Middleware có logic bỏ qua tất cả các kiểm tra xác thực nếu phát hiện `process.env.NODE_ENV === 'development'`. Nếu môi trường staging hoặc thử nghiệm bị chạy sai cấu hình này, toàn bộ hệ thống sẽ bị mở toang không cần đăng nhập.
  2. *Không chặn truy cập dashboard:* Khi kiểm tra quyền truy cập dashboard, middleware chỉ thực hiện gán trường `x-required-permission` vào header của response chứ không thực hiện chặn (`return NextResponse.redirect` hoặc trả về lỗi 403) đối với các yêu cầu không đủ quyền. Nếu các trang dashboard (Server/Client Components) không đọc header này để chặn thủ công, bất kỳ người dùng nào đã đăng nhập đều có thể truy cập toàn bộ các trang quản trị hệ thống.
- **Giải pháp:**
  1. Loại bỏ điều kiện bỏ qua kiểm tra tự động khi chạy dev mode, hoặc giới hạn nghiêm ngặt chỉ bỏ qua nếu chạy ở localhost thực tế.
  2. Thực hiện chặn và redirect về trang lỗi hoặc trang login ngay trong middleware nếu user không sở hữu quyền cần thiết được định nghĩa trong `ROUTE_PERMISSIONS`.
