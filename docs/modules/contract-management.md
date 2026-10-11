# Contract Management (Quản Lý Hợp Đồng)

Phân hệ Quản Lý Hợp Đồng là "xương sống pháp lý" của toàn bộ quan hệ mua-bán. Mọi giao dịch đều bắt nguồn từ 1 bản hợp đồng ký kết. Hệ thống sẽ liên kết chặt Hợp Đồng → PO/SO → Hóa Đơn → Thanh Toán, tạo ra chuỗi truy vết hoàn chỉnh từ đầu đến cuối.

---

## 1. Loại Hợp Đồng Cần Quản Lý

| Loại | Đối tượng | Mô tả |
|---|---|---|
| **Hợp Đồng Mua Hàng (Purchase Agreement)** | Nhà Cung Cấp (Supplier) | Điều khoản mua hàng dài hạn khung, PO sẽ reference đến HĐ này |
| **Hợp Đồng Bán Hàng (Sales Agreement)** | Khách Hàng / Đại Lý | Cam kết mua hàng theo kỳ, giá ưu đãi đặc biệt |
| **Hợp Đồng Ký Gửi (Consignment Agreement)** | HORECA | Xem chi tiết tại `consignment.md` |
| **Hợp Đồng Logistics / Agency** | Forwarder, Customs Broker | Điều khoản dịch vụ, biểu phí |
| **Hợp Đồng Thuê Kho** | Đơn vị cho thuê kho | Diện tích, giá thuê, điều khoản nhiệt độ |

---

## 2. Thông Tin Căn Bản Của Một Hợp Đồng

- Số hợp đồng (Contract No.) — Tự sinh hoặc nhập tay theo quy ước
- Loại hợp đồng (Contract Type)
- Đối tác liên quan (Linked Supplier / Customer)
- Ngày ký, Ngày hiệu lực, Ngày hết hạn
- Giá trị hợp đồng (Contract Value) và Đồng tiền
- Điều khoản thanh toán (Payment Terms): Đặt cọc bao nhiêu %, cách nào (L/C, T/T), trong bao nhiêu ngày
- Điều khoản giao hàng (Incoterms): FOB / CIF / EXW / DDP...
- Trạng thái (Status): DRAFT → PENDING_SIGN → ACTIVE → EXPIRED / TERMINATED
- File đính kèm (Upload PDF bản scan hợp đồng gốc)

---

## 3. Tính Năng Cốt Lõi

### A. Cảnh Báo Hết Hạn (Expiry Alert)
- Hệ thống tự động gửi thông báo **30 ngày, 7 ngày trước khi hết hạn** cho nhân viên quản lý hợp đồng và CEO
- Dashboard hiển thị danh sách "Hợp Đồng Sắp Hết Hạn" để chủ động gia hạn

### B. Liên Kết Với PO / SO
- Khi tạo PO, nhân viên Thu mua **bắt buộc** chọn liên kết với Hợp Đồng Mua Hàng tương ứng
- Hệ thống kiểm tra PO có vượt giá trị còn lại của HĐ khung không? Nếu vượt → Cảnh báo, yêu cầu duyệt CEO
- Theo dõi **Giá trị Thực Hiện (Utilized Value)** so với Giá trị Hợp đồng

### C. Quản Lý Phụ Lục Sửa Đổi (Amendments / Addendum)
- Khi hai bên thỏa thuận thay đổi điều khoản (giá, hạn mức, điều khoản thanh toán), hệ thống cho phép tạo **Phụ lục (Amendment)** gắn vào hợp đồng gốc thay vì tạo HĐ mới
- Ghi rõ Amendment No., Ngày ký, Nội dung thay đổi

### D. Digital Signature (Ký Điện Tử Nội Bộ)
- CEO hoặc người được ủy quyền có thể **ký điện tử** bản nháp HĐ ngay trong hệ thống trước khi gửi cho đối tác
- Lưu lại timestamp ký, chữ ký số để làm bằng chứng nội bộ

### E. Thống Kê Hợp Đồng
- Báo cáo: Tổng giá trị HĐ đang active / đã expired
- Tỷ lệ thực hiện HĐ mua hàng theo từng Nhà Cung Cấp (Committed vs Actual PO)
- Phân tích điều khoản thanh toán hiện tại của tất cả NCC (Vẽ được bức tranh dòng tiền tổng thể)

---

## 4. Liên Kết Với Các Module Khác

```
Contract (HĐ Mua Hàng)
    └─→ PurchaseOrder (Nhiều PO có thể dưới 1 HĐ)
            └─→ Shipment / LandedCost
                    └─→ GoodsReceipt (WMS)
                            └─→ AccountsPayable (FIN)

Contract (HĐ Bán Hàng)
    └─→ SalesOrder (Nhiều SO có thể dưới 1 HĐ Đại lý)
            └─→ DeliveryOrder (WMS/TRS)
                    └─→ Invoice → AccountsReceivable (FIN)
```

---

## 5. Database Design

- `Contract`: Entity chính lưu thông tin hợp đồng
- `ContractAmendment`: Phụ lục sửa đổi
- `ContractDocument`: File đính kèm (PDF scan, file nháp)
- `ContractAlert`: Cấu hình cảnh báo hết hạn
- `ContractUtilization`: Theo dõi tổng giá trị PO/SO đã tạo dưới HĐ

---

## 6. Implementation Status (Trạng Thái Triển Khai)

> Cập nhật 08/03/2026 — **Hoàn thiện 100%**

### ✅ Đã triển khai — Module HĐ gốc

| Tính năng | File code | Ghi chú |
|---|---|---|
| Contract CRUD | `contracts/actions.ts` | Tạo, xem, cập nhật status |
| Contract Stats | `getContractStats` | KPI: total, active, expiring, total value |
| **Link Contract ↔ SO** | `linkContractToSO` | Liên kết HĐ → Sales Order |
| **Link Contract ↔ PO** | `linkContractToPO` | Liên kết HĐ → Purchase Order |
| **Utilization Tracking** | `getContractUtilization` | PO + SO value vs contract value, utilization % |
| **Expiry Alerts** | `getExpiringContracts(30)` | Cảnh báo 30 ngày trước hết hạn |
| **Auto-Expire** | `autoExpireContracts` | Tự động chuyển EXPIRED cho HĐ quá hạn |
| **Email Alerts** | `sendContractExpiryAlerts` | Gửi email thông báo sắp hết hạn |
| **Amendment** | `createContractAmendment` | Phụ lục sửa đổi: new value, new end date |
| **Document Upload** | `uploadContractDocument` | Upload PDF/scan → Supabase Storage |
| **Digital Signature** | `signContractInternal` | Chữ ký số nội bộ + hash verification |

### ✅ Đã triển khai — Regulated Documents (Giấy Tờ Có Hạn)

> Phiên bản CNT v2. Triển khai ngày 08/03/2026.

| Tính năng | File code | Ghi chú |
|---|---|---|
| **3 Models mới** | `schema.prisma` | `RegulatedDocument`, `RegDocFile`, `RegDocAlert` |
| **27 loại giấy tờ** | `RegDocType` enum | GP, PCCC, VSATTP, C/O, Phiếu KN, Tem rượu... |
| **5 nhóm** | `RegDocCategory` enum | DN, NK, SP, Kho&PCCC, HĐ TM |
| **6 phạm vi** | `RegDocScope` enum | Công ty, NCC, KH, SP, Shipment, Lot |
| **CRUD + Renewal** | `reg-doc-actions.ts` | Tạo, sửa, xóa, gia hạn (giữ lịch sử tùy chọn) |
| **File Upload** | `uploadRegDocFile` | Upload file đính kèm per version |
| **Compliance Warnings** | `getComplianceWarnings` | Auto severity: critical/warning/info |
| **Auto-Expire** | `autoExpireRegDocs` | Update ACTIVE→EXPIRING→EXPIRED |
| **Linked Entities** | FK polymorphic | Link to Supplier, Customer, Product, Shipment, StockLot |
| **CEO Dashboard Widget** | `page.tsx` | "Cảnh Báo Tuân Thủ" — badge count + severity rows |
| **2-Tab Layout** | `ContractsPage.tsx` | "Hợp Đồng" + "Giấy Tờ Có Hạn" with badge counts |
| **Zod Validations** | `validations.ts` | `RegDocCreateSchema`, `RegDocUpdateSchema`, `RegDocRenewSchema` |

### ✅ Đã triển khai — Tạo Hợp Đồng Từ Biểu Mẫu Word (.docx) & Kho Mẫu Biểu

> Phiên bản CNT v3. Triển khai ngày 11/10/2026.

| Tính năng | File code | Ghi chú |
|---|---|---|
| **DOCX Generator Engine** | `src/lib/docx-generator.ts` | Merge dữ liệu vào template Word với `docxtemplater` + `pizzip`, xử lý bảng sản phẩm lặp dòng `{#san_pham}...{/san_pham}` |
| **Đọc số tiền thành chữ VN** | `src/lib/vietnamese-words.ts` | Chuẩn kế toán & hành chính Việt Nam (hỗ trợ VNĐ và USD) |
| **Kho Biểu Mẫu Ngành Rượu** | `public/templates/contracts/` | 3 mẫu chuẩn: `HD_NGUYEN_TAC.docx` (HĐNT B2B), `HD_KY_GUI.docx` (Phụ lục ký gửi), `HD_MOT_LAN.docx` (HĐ mua bán từng đơn có bảng rượu) |
| **Template Server Actions** | `contracts/template-actions.ts` | `getContractTemplatesAction`, `getCounterpartyDetailAction` (auto-fill Bên B), `getAvailableProductsForContractAction`, `generateContractFromTemplateAction` |
| **Drawer Tạo HĐ Từ Mẫu** | `CreateFromTemplateDrawer.tsx` | Wizard 3 bước: Chọn mẫu $\rightarrow$ Điền thông tin tự động $\rightarrow$ Sinh & Tải file Word (.docx) và lưu vào `ContractDocument` |
| **Tab Kho Biểu Mẫu** | `ContractTemplatesTab.tsx` | Quản lý mẫu, tải file mẫu trắng `.docx`, tra cứu bảng biến thay thế (placeholders) |
| **Tích hợp 3-Tab Layout** | `ContractsPage.tsx` | "Hợp Đồng" + "Kho Biểu Mẫu (.docx)" + "Giấy Tờ Có Hạn" |

*Last updated: 2026-10-11 | Wine ERP v6.1*


