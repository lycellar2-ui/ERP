# Margin Simulation (MGN) — Wine ERP Module Spec

> **Route:** `/dashboard/margin`
> **Mã module:** MGN
> **Thêm ngày:** 2026-08-07

---

## Mô Tả

Module Mô phỏng biên lợi nhuận (Margin Simulation) cho phép quản lý xem, tính toán và cập nhật giá bán lẻ/bán sỉ của sản phẩm dựa trên giá vốn, biên lợi nhuận mong muốn, và các quy tắc giá đặc biệt.

## Tính Năng

### Bảng Margin Products
- Hiển thị tất cả sản phẩm active kèm: SKU, tên, loại rượu, quốc gia, ảnh
- **Giá trước thuế**: Cost Price, Retail Price, Wholesale Price
- Đánh dấu sản phẩm có Custom Price (giá tùy chỉnh)

### Margin Calculation
- Tính biên lợi nhuận (margin %) tự động: `(Selling Price - Cost Price) / Selling Price × 100`
- So sánh margin giữa retail vs wholesale
- Filter theo Supplier

### Price Update (Batch)
- Cập nhật giá bán lẻ/sỉ hàng loạt qua model `ProductMarginPrice`
- Audit trail cho mọi thay đổi giá

## Files

| File | Vai trò |
|---|---|
| `actions.ts` | `getMarginSuppliers()`, `getMarginProducts()`, `updateMarginPrice()`, `batchUpdateMarginPrices()` |
| `MarginClient.tsx` | Client component 84KB — bảng, filter, batch editor |
| `page.tsx` | Server page wrapper |

## Prisma Models

- `ProductMarginPrice` — Bảng lưu giá margin tùy chỉnh per product

## Domain Ownership

- **Bảng sở hữu:** `ProductMarginPrice`
- **Đọc từ:** `Product`, `Producer`, `Supplier`, `CustomerPriceRule`

## Phụ thuộc
- MDM (đọc Product/Producer/Supplier)
- SLS (đọc CustomerPriceRule để biết giá đặc biệt)
