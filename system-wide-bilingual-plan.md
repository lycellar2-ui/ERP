# 🌐 MASTER PLAN: Kế Hoạch Triển Khai Song Ngữ (Bilingual VI/EN) Toàn Hệ Thống Wine ERP

> **Mã Đề Án:** `I18N-SYSTEM-WIDE-ROLLOUT-2026`  
> **Chuyên gia phụ trách:** `project-planner` & `frontend-specialist`  
> **Phạm vi:** Toàn bộ 30 phân hệ (Modules), Shell Layout, Common Components, Báo cáo & Xuất file  
> **Kiến trúc cốt lõi:** Lightweight Modular i18n Engine (Zero Routing Overhead, 100% App Router Compatible)

---

## 1. Hiện Trạng & Kiến Trúc Kỹ Thuật (Architecture Foundation)

### 1.1. Hiện Trạng Đã Có (Completed Baseline)
- ✅ **Core Locale Engine (`src/lib/i18n.ts`):** Quản lý trạng thái `locale` ('vi' | 'en'), đồng bộ 2 chiều qua `localStorage ('erp_locale')` và Custom Event toàn trang `window.dispatchEvent('erp_locale_change')`.
- ✅ **Khung Điều Hướng Shell Layout:**
  - `Sidebar.tsx`: Toàn bộ 7 nhóm danh mục, 38 menu items, footer & nút thu gọn đã hỗ trợ song ngữ.
  - `Header.tsx`: Nút gạt chuyển ngôn ngữ (VN/EN Switcher) trên thanh topbar.
- ✅ **Các màn hình đã thí điểm thành công:**
  - `CEO Dashboard` (`/dashboard`): DashboardHeaderNav, DashboardFilterBar, DailyRevenueChart, CeoOverviewContent.
  - `Tờ Trình & Đề Xuất` (`/proposals`): Danh sách, bộ lọc, thẻ KPI, Drawer Chi tiết & Drawer Tạo mới.
  - `Viếng Thăm Điểm Bán` (`/sales/visits`): GPS check-in, form khảo sát.

### 1.2. Lựa Chọn Kiến Trúc Cho Toàn Hệ Thống (Architectural Decisions)
1. **Tuyệt đối KHÔNG can thiệp URL Routing (`/[locale]/dashboard/...`):**
   - Giữ nguyên cấu trúc route chuẩn Next.js App Router hiện tại. Tránh gãy 36 route, tránh xung đột middleware RBAC và không làm hỏng bookmark của người dùng.
2. **Mô hình Hybrid i18n Dictionaries:**
   - **`src/lib/i18n/common.ts` (Từ điển dùng chung):** Chứa các nhãn thao tác phổ quát (Lưu, Hủy, Xóa, Sửa, Tìm kiếm, Xuất Excel, In ấn, Phân trang, Xác nhận, Bộ lọc thời gian, Trạng thái chung).
   - **`src/app/dashboard/{module}/i18n.ts` (Từ điển chuyên ngành từng phân hệ):** Tách biệt theo ranh giới Domain-Driven Design (DDD), lazy-load cùng Client Component của route đó, không làm phình bundle size của các trang khác.
3. **Quy tắc hiển thị dữ liệu động & Định dạng (Đã thống nhất):**
   - **Định dạng số & ngày tháng:** Thích ứng 100% theo locale:
     - `vi`: `1.000.000 ₫`, `DD/MM/YYYY` (ví dụ: `24/10/2026`).
     - `en`: `1,000,000 VND` (hoặc `$`), `MM/DD/YYYY` (ví dụ: `10/24/2026`).
   - **Phạm vi áp dụng:** Chuyển ngữ toàn bộ UI trên màn hình (tables, filters, cards, forms, drawers, toasts). Các mẫu in/PDF (Hóa đơn, Báo giá xuất file) giữ nguyên chuẩn hiện tại.
   - **Tên dữ liệu động:** Dùng tìm kiếm không phân biệt dấu/hoa thường; nếu có phân cách `Tiếng Việt / English` thì tách theo locale.
   - **Audit Log & Notifications:** Giữ nguyên tiếng Việt chuẩn doanh nghiệp ở backend để đảm bảo giá trị pháp lý, chỉ frontend render giao diện theo locale người dùng.

---

## 2. Lộ Trình Triển Khai 6 Giai Đoạn (6-Phase Rollout Roadmap)

Hệ thống gồm **30 modules**, được phân nhóm theo mức độ ưu tiên nghiệp vụ và tần suất người dùng quốc tế/lãnh đạo sử dụng:

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: CORE INFRASTRUCTURE & SHARED DICTIONARY                      │
│ Chuẩn hóa Common Dictionary, Form Controls, Tables, Modals & Toast     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ PHASE 2: THƯƠNG MẠI & BÁN HÀNG (COMMERCIAL CORE)                       │
│ Bán hàng (SLS), Báo giá (Quotation), Bảng giá, Phân bổ (Allocation)   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ PHASE 3: KHO VẬN & CHUỖI CUNG ỨNG (SUPPLY CHAIN & LOGISTICS)           │
│ Kho hàng (WMS), Nhập/Xuất (GR/DO), Điều chuyển, Kiểm kê, Vận chuyển   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ PHASE 4: THU MUA, HỢP ĐỒNG & NHẬP KHẨU (IMPORT & PROCUREMENT)          │
│ Thu mua (PO), Hợp đồng (CNT), Vận đơn quốc tế, Chi phí giá vốn (CST)  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ PHASE 5: TÀI CHÍNH, KẾ TOÁN & THUẾ (FINANCE, TAX & REPORTING)          │
│ Sổ cái, P&L, Cân đối kế toán, Công nợ AR/AP, Tem rượu, Báo cáo BI      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ PHASE 6: MASTER DATA, CRM, NHÂN SỰ & QUẢN TRỊ HỆ THỐNG                 │
│ Khách hàng, Sản phẩm, CRM 360, POS, Nhân sự (HR), Cài đặt phân quyền   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Chi Tiết Kế Hoạch Từng Giai Đoạn

### 🔷 Giai Đoạn 1: Nâng Cấp Nền Tảng i18n & Từ Điển Dùng Chung
*Mục tiêu: Đảm bảo mọi modal, bảng, thanh tìm kiếm, nút bấm có sẵn từ khóa dùng chung.*
- [ ] **Xây dựng `src/lib/i18n/common.ts`:**
  - **Hành động:** `save`, `cancel`, `delete`, `edit`, `create`, `add`, `import`, `export`, `search`, `filter`, `reset`, `refresh`, `close`, `back`, `confirm`, `print`, `download`, `upload`.
  - **Bảng dữ liệu & Phân trang:** `noData`, `loading`, `totalRows`, `page`, `of`, `rowsPerPage`, `actions`, `status`, `createdAt`, `updatedAt`, `createdBy`.
  - **Trạng thái phổ biến:** `all`, `draft`, `pending`, `confirmed`, `approved`, `rejected`, `processing`, `completed`, `cancelled`, `active`, `inactive`.
  - **Đơn vị & Tiền tệ:** `vnd`, `usd`, `eur`, `bottle`, `case`, `pallet`, `items`.
- [ ] **Tiện ích Format Date & Number theo Locale:**
  - Chuẩn hóa format ngày: `vi`: `DD/MM/YYYY`, `en`: `MM/DD/YYYY` hoặc `YYYY-MM-DD`.
  - Chuẩn hóa hiển thị tiền tệ: `1.000.000 ₫` (vi) vs `1,000,000 VND` (en).

---

### 🔷 Giai Đoạn 2: Phân Hệ Thương Mại & Bán Hàng (Commercial Core)
*Đặc thù: Phân hệ tiếp xúc khách hàng, nhân viên kinh doanh và đối tác nước ngoài.*
- [ ] **Đơn Hàng Bán Hàng (`/sales`):**
  - Danh sách đơn, bộ lọc kênh bán, tabs trạng thái (Chờ duyệt, Đã xác nhận, Đang giao, Đã giao).
  - Chi tiết đơn hàng, drawer tạo đơn hàng mới, tính toán chiết khấu, hạn mức công nợ.
- [ ] **Báo Giá Chuyên Nghiệp (`/quotations`):**
  - Chuyển ngữ giao diện quản lý báo giá và mẫu xuất PDF song ngữ (Professional/Elegant).
- [ ] **Bảng Giá & Chiết Khấu (`/price-list`):**
  - Cơ chế giá bán lẻ, giá sỉ, chiết khấu kênh HORECA.
- [ ] **Phân Bổ Rượu Hiếm (`/allocation`):**
  - Hạn ngạch phân bổ Grand Cru cho từng nhân sự / khách hàng VIP.
- [ ] **Đổi Trả Hàng (`/returns`):**
  - Phiếu yêu cầu đổi trả, Credit Note, nguyên nhân hoàn trả.

---

### 🔷 Giai Đoạn 3: Kho Vận & Chuỗi Cung Ứng (Warehouse & Logistics)
*Đặc thù: Nhiều thuật ngữ kho bãi, vị trí kệ, lô hàng và niên vụ rượu.*
- [ ] **Quản Lý Kho Hàng Trung Tâm (`/warehouse`):**
  - Phiếu nhập kho (Goods Receipt - GR), Phiếu xuất kho (Delivery Order - DO).
  - Thống kê tồn kho thực tế, tồn thùng, chai lẻ, hàng cách ly (Quarantine).
  - Sơ đồ kho 2D (`WarehouseMapTab`), Quản lý vị trí Kệ/Dãy/Ô (`LocationManager`).
- [ ] **Điều Chuyển Kho & Cân Bằng Tồn (`/transfers`):**
  - Lệnh chuyển kho nội bộ giữa Hà Nội - Đà Nẵng - TP.HCM.
  - Gợi ý cân bằng tồn kho tự động (Replenishment).
- [ ] **Kiểm Kê Kho (`/stock-count`):**
  - Phiếu kiểm kê định kỳ, đối soát chênh lệch sổ sách và thực tế.
- [ ] **Vận Chuyển & Giao Hàng (`/delivery`):**
  - Phân tuyến giao vận, trạng thái E-POD (ký nhận điện tử), COD đối soát.
- [ ] **Mã QR & Tem Nhãn (`/qr-codes`):**
  - Tem chống hàng giả, truy xuất nguồn gốc chai rượu.

---

### 🔷 Giai Đoạn 4: Thu Mua, Hợp Đồng & Nhập Khẩu Quốc Tế
*Đặc thù: Thường xuyên làm việc với nhà cung cấp (château, winery) nước ngoài tại Pháp, Ý, Chile...*
- [ ] **Đơn Mua Hàng Quốc Tế (`/procurement`):**
  - Purchase Orders (PO), Bảng kê thuế nhập khẩu, thuế TTĐB, VAT theo HS Code.
- [ ] **Quản Lý Hợp Đồng & Tài Liệu Pháp Lý (`/contracts`):**
  - Hợp đồng mua/bán song ngữ, phụ lục hợp đồng, chứng từ hải quan.
- [ ] **Theo Dõi Vận Đơn & Container (`/shipments`):**
  - Tracking hải trình tàu biển, trạng thái thông quan, chi phí demurrage/detention.
- [ ] **Giá Vốn Đích Danh Hàng Nhập (`/costing`):**
  - Bảng tính Landed Cost (CIF + Thuế + Vận chuyển + Bảo hiểm = Giá vốn/chai).
- [ ] **Cổng Đại Lý / Đối Tác Nhập Khẩu (`/agency`):**
  - Giao diện đối tác ủy thác hải quan, hãng tàu.

---

### 🔷 Giai Đoạn 5: Tài Chính, Kế Toán & Thuế (Finance & Compliance)
*Đặc thù: Đòi hỏi tính chuẩn xác tuyệt đối của thuật ngữ kế toán quốc tế (IFRS / VAS).*
- [ ] **Sổ Cái & Bút Toán Kế Toán (`/finance`):**
  - Sổ nhật ký chung (General Journal), Báo cáo kết quả kinh doanh (P&L), Bảng cân đối kế toán (Balance Sheet), Báo cáo lưu chuyển tiền tệ (Cash Flow).
  - Bảng mã tài khoản kế toán (Chart of Accounts: 111, 112, 131, 156, 331, 511, 632, 641, 642...).
- [ ] **Quản Lý Công Nợ Phải Thu / Phải Trả (AR/AP):**
  - Báo cáo tuổi nợ (Aging Report), Đối soát thanh toán hóa đơn.
- [ ] **Quản Lý Tem Rượu Nhập Khẩu (`/stamps`):**
  - Quản lý hạn ngạch tem Bộ Tài Chính, dán tem, quyết toán tem.
- [ ] **Khai Báo & Quyết Toán Thuế (`/declarations`):**
  - Bảng kê thuế tiêu thụ đặc biệt, thuế GTGT, hồ sơ điện tử.
- [x] **Báo Cáo Quản Trị & BI (`/reports`) — HOÀN THÀNH (Triển khai cùng CEO Dashboard theo chỉ đạo Giai Đoạn 6):**
  - 16 danh mục báo cáo Excel chuẩn (R01–R16) song ngữ, 3 tabs phân tích đa chiều (Overview, Export, Schedule), format VND thích ứng theo locale.

---

### 🔷 Giai Đoạn 6: Báo Cáo & Điều Hành (Executive Dashboard & BI Reports) — ĐÃ HOÀN THÀNH ✅
*Phạm vi hoàn tất:*
- [x] **CEO Executive Dashboard (`/dashboard`):**
  - 100% nhãn KPI cards, P&L, Cash Flow, AR Aging, In-depth targets, Top rankings.
  - Vận đơn Container đang về, Cảnh báo tuân thủ pháp lý, Trung tâm phê duyệt CEO (Proposals & SOs).
  - Biểu đồ DailyRevenueChart tự động dịch ngày trong tuần (Mon..Sun vs Thứ 2..CN), tooltip và format tiền tệ.
  - Đồng bộ `useAppLocale()`, `formatCurrency`, `formatDate`.
- [x] **Báo Cáo BI Quản Trị (`/dashboard/reports`):**
  - Tạo mới bộ từ điển `REPORTS_I18N` tại `src/app/dashboard/reports/i18n.ts`.
  - 3 tabs trực quan: Tổng quan BI, Bảng kê 16 báo cáo Excel (.xlsx), Giám sát lịch gửi tự động.
  - Phân loại kênh bán quốc tế (`HORECA`, `Wholesale / Distributor`, `VIP Retail`, `Direct / Retail`) và chủng loại rượu vang.
*Đặc thù: Quản trị dữ liệu dùng chung và công cụ quản trị.*
- [ ] **Master Data (`/products`, `/customers`, `/suppliers`):**
  - Danh mục rượu (Giống nho - Grape variety, Niên vụ - Vintage, Vùng làm rượu - Region/Appellation, Nồng độ - ABV).
  - Hồ sơ khách hàng (B2B, B2C, HORECA, VIP Tier), Hồ sơ Nhà cung cấp quốc tế.
- [ ] **CRM & Phễu Bán Hàng (`/crm`, `/pipeline`):**
  - Hồ sơ 360°, Phễu khách hàng tiềm năng, Lịch sử nếm thử rượu (Tasting events).
- [ ] **POS Showroom Bán Lẻ (`/pos`):**
  - Giao diện thu ngân màn hình cảm ứng, tích điểm thành viên (Loyalty).
- [ ] **Quản Lý Nhân Sự & Hồ Sơ (`/hr`):**
  - Hợp đồng lao động, CCCD/Passport, Chứng chỉ sommelier, Cảnh báo thời hạn.
- [ ] **Quản Trị Hệ Thống & Bảo Mật (`/settings`, `/settings/approval-matrix`, `/audit-log`):**
  - Phân quyền (Roles & Permissions), Ma trận phê duyệt đa cấp, Nhật ký kiểm toán.
- [ ] **Trung Tâm Trí Tuệ Nhân Tạo (`/ai`):**
  - Quản trị API Key, Quản lý System Prompts & AI Briefing.

---

## 4. Chuẩn Hóa Bảng Thuật Ngữ Song Ngữ (Wine ERP Glossary)

| Thuật ngữ Tiếng Việt | English Equivalent | Context |
|---|---|---|
| **Đơn hàng bán** | Sales Order (SO) | Commercial |
| **Báo giá** | Quotation | Commercial |
| **Phân bổ hạn ngạch** | Quota Allocation | Commercial |
| **Đơn mua hàng** | Purchase Order (PO) | Procurement |
| **Phiếu nhập kho** | Goods Receipt (GR) | WMS |
| **Phiếu xuất kho** | Delivery Order (DO) | WMS |
| **Tồn kho sẵn sàng** | Available Stock | WMS |
| **Hàng cách ly / Chờ xử lý** | Quarantine Stock | WMS |
| **Cân bằng tồn kho** | Stock Replenishment | WMS |
| **Kiểm kê định kỳ** | Stock Count / Inventory Audit | WMS |
| **Giá vốn đích danh** | Landed Cost | Costing |
| **Giá vốn hàng bán** | Cost of Goods Sold (COGS) | Finance |
| **Doanh thu thuần** | Net Revenue | Finance |
| **Lợi nhuận gộp** | Gross Profit | Finance |
| **Biên lợi nhuận gộp** | Gross Margin (%) | Finance |
| **Sổ nhật ký chung** | General Journal | Finance |
| **Bảng cân đối kế toán** | Balance Sheet | Finance |
| **Báo cáo kết quả kinh doanh** | Profit & Loss Statement (P&L) | Finance |
| **Niên vụ rượu** | Vintage | Wine MDM |
| **Vùng trồng nho / Phân hạng** | Appellation / Region | Wine MDM |
| **Giống nho** | Grape Variety | Wine MDM |
| **Độ cồn** | Alcohol By Volume (ABV%) | Wine MDM |
| **Thuế tiêu thụ đặc biệt** | Special Consumption Tax (SCT) | Tax |
| **Thuế nhập khẩu** | Import Duty | Tax |
| **Tem rượu nhập khẩu** | Wine Stamp | Compliance |

---

## 5. Quy Chuẩn Kỹ Thuật Khi Triển Khai (Coding Standards & Checklist)

1. **Tuân thủ quy tắc Clean Code & Single Source of Truth:**
   - Mọi từ điển phân hệ đặt tại `src/app/dashboard/{module}/i18n.ts`.
   - Mọi component sử dụng hook chuẩn: `const { locale, isEn } = useAppLocale()`.
2. **Không làm vỡ layout (No Overflow / Wrapping Glitch):**
   - Tiếng Anh thường ngắn hoặc dài hơn tiếng Việt (ví dụ: "Xác nhận xuất kho" vs "Confirm Delivery"). Phải dùng Tailwind linh hoạt `whitespace-nowrap truncate` hoặc responsive padding.
3. **Tuân thủ DOCS SYNC PROTOCOL:**
   - Hoàn thành module nào -> cập nhật file `docs/modules/{module}.md` tương ứng.
4. **Kiểm tra TypeScript & Linter liên tục:**
   - Chạy `npx tsc --noEmit` sau mỗi module để đảm bảo 0 lỗi kiểu dữ liệu.
