# UI/UX Design System — LY's Cellars Wine ERP
**Nguyên tắc:** "The Mediterranean Vault" — Chiều sâu của biển Địa Trung Hải, sang trọng của hầm rượu hiện đại.
Không phải SaaS xanh thông thường. Không phải dashboard fintech. Đây là phần mở rộng kỹ thuật số của showroom LY's Cellars số 12.

---

## 1. Định Hướng Thiết Kế (Design Direction)

### Đối Tượng Sử Dụng & Cảm Xúc Cần Truyền Tải

| Người dùng | Ngữ cảnh sử dụng | Cảm xúc cần gợi ra |
|---|---|---|
| **CEO** | Văn phòng, máy tính hoặc iPad | Kiểm soát, tin tưởng, rõ ràng |
| **Sales Rep** | Gặp khách tại nhà hàng, điện thoại | Chuyên nghiệp, nhanh, dễ tra cứu |
| **Thủ Kho** | Trong kho, điện thoại, tay có thể bẩn | Đơn giản, to rõ, thao tác 1 tay |
| **Kế Toán** | Bàn làm việc, desktop | Dày đặc thông tin, chính xác |
| **Shipper** | Trên xe, điện thoại, ánh sáng thay đổi | Cực kỳ đơn giản, nút to, ít chữ |
| **Agency HQ** | Văn phòng, cổng riêng | Rõ ràng, có hướng dẫn |

### Triết Lý Thiết Kế — "The Mediterranean Vault"
Lấy cảm hứng từ showroom tại số 12 với cửa xanh Navy đặc trưng và logo LY's Cellars:

- **Tối sâu nhưng khoáng đạt:** Xanh Navy cực đậm (#0A1926) — như màu cửa showroom dưới bóng râm
- **Teal là linh hồn:** Màu Teal từ logo (#87CBB9) là điểm nhấn hiện đại trên nền kiến trúc tối
- **Whitespace:** Luxury = breathing room. Mô phỏng các ô kính lớn tại showroom
- **Burgundy cho cảnh báo:** Màu rượu vang đỏ (#8B1A2E) — đúng ngữ cảnh cho lỗi/quá hạn
- **Không gradient sặc sỡ, không neon** — Tinh tế hơn là phô trương

---

## 2. Color System — "Oceanic Cellar"

### Bảng Màu Chính (Dark Mode Ưu Tiên — CEO/Showroom)

```
Nền chính    → #0A1926   (Deep Sea Navy — biển sâu và sự tĩnh lặng)
Nền phụ      → #142433   (Midnight Teal — chiều sâu hầm rượu hiện đại)
Nền card     → #1B2E3D   (Steel Blue — tạo khối tách biệt nhưng đồng nhất)
Border       → #2A4355   (Deep Ocean — viền mảnh, tinh tế)

Accent chính → #87CBB9   (Teal Logo — LINH HỒN của LY's Cellars)
Accent phụ   → #A5DED0   (Mint Light — hover states, trạng thái tích cực)
Accent navy  → #1A4363   (Showroom Door Navy — màu cửa chính)

Text chính   → #E8F1F2   (Cool White — trắng hơi xanh, sạch và sang trọng)
Text phụ     → #8AAEBB   (Steel Muted — labels, captions)
Text muted   → #4A6A7A   (Deep Muted — placeholder, dim text)

Success      → #5BA88A   (Teal Success — đồng nhất với accent)
Warning      → #D4A853   (Amber Warm — thông báo, cần chú ý)
Error        → #8B1A2E   (Burgundy Red — màu rượu vang, cho lỗi/quá hạn)
Info         → #4A8FAB   (Ocean Info — thông tin chung)
```

### Light Mode (Cho Kế Toán & Quản Lý Ban Ngày)

```
Nền chính    → #F5F8F9   (Trắng vôi Địa Trung Hải — lấy từ tường showroom)
Nền phụ      → #EBF2F5   (Xanh nhạt)
Nền card     → #FFFFFF
Border       → #C5D8E0   (Xanh nhạt)

Accent chính → #1A7A62   (Teal đậm cho light mode)
Text chính   → #1A4363   (Xanh Navy đậm từ cửa chính)
Text phụ     → #3A6078   (Navy trung)
```

### Quy Tắc Sử Dụng Màu
- **60%** Nền Navy tối (Background layers: #0A1926, #142433)
- **30%** Card / Surface (#1B2E3D, #142433)
- **10%** Accent Teal (#87CBB9) — CTA, Highlights, Active state
- Màu Burgundy (#8B1A2E) chỉ dùng cho **Alert / Error / Quá Hạn**
- **TUYỆT ĐỐI KHÔNG** dùng màu đen thuần, nâu ấm, vàng đồng (Cave Noir)

---

## 3. Typography (Giữ nguyên — Perfect pairing với LY's Cellars)

### Font Pairing

```
Heading Display:  "Cormorant Garamond"  — Serif thanh lịch, đồng bộ với chữ "LY's" trong logo
                  (Google Font — Free)

Body & UI:        "DM Sans"             — Sans-serif sạch, đọc được ở mọi size
                  (Google Font — Free)

Data / Mono:      "DM Mono"             — Cho số tiền, mã SKU, code
                  (Google Font — Free)
```

### Thang Kích Thước (Type Scale — Ratio 1.25)

```
xs:   12px  — Timestamp, footer labels
sm:   14px  — Table data, form labels
base: 16px  — Body text (tối thiểu)
lg:   20px  — Card headers, section subtitles
xl:   25px  — Page titles
2xl:  31px  — Dashboard KPI numbers
3xl:  39px  — Hero stats (Revenue tháng trên CEO dashboard)
4xl:  49px  — Display only
```

### Quy Tắc Typography
- Tên module / Page title: `Cormorant Garamond` Bold
- Số KPI lớn (Revenue, Inventory Value): `DM Mono` Bold → Tránh chữ số nhảy
- Tất cả text body, label, button: `DM Sans`
- Số âm (lỗ, thiếu hụt): Màu Burgundy (#8B1A2E)
- Số dương (lời, thặng dư): Màu Teal (#87CBB9) hoặc Teal Success (#5BA88A)

---

## 4. Layout System

### Responsive Breakpoints

```
Mobile:   < 640px   — Shipper, Thủ Kho (ưu tiên cao nhất)
Tablet:   640–1024px — Sales Rep với iPad
Desktop: > 1024px   — CEO, Kế Toán, Admin
Wide:    > 1440px   — Dashboard CEO với nhiều màn hình
```

### Navigation Structure

**Desktop:**
```
┌──────────────────────────────────────────────────────────┐
│  🍷 LY's Cellars    [Search]           [Notif] [Avatar] │  ← Topbar (Navy #142433)
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│ Sidebar  │           Main Content Area                  │
│ (240px)  │           (Background: #0A1926)              │
│ (#142433)│                                              │
│          │                                              │
│ [DSH]    │                                              │
│ [MDM]    │                                              │
│ [CRM]    │                                              │
│ ...      │                                              │
│          │                                              │
│ [Logout] │                                              │
└──────────┴───────────────────────────────────────────────┘
```

### Sidebar (Desktop)
- **Icon + Label** khi mở rộng (240px), **Icon only** khi thu nhỏ (64px)
- Active item: Màu Teal (#87CBB9) + Border-left Teal + Nền nhẹ (rgba(135,203,185,0.12))
- Hover: Nền nhấc lên rgba(135,203,185,0.06), text Cool White
- Logo: SVG chiếc ly Teal + "LY's Cellars" font Cormorant Garamond

---

## 5. Component Design

### 5.1 KPI Card (CEO Dashboard)

```
┌────────────────────────────────┐
│  Doanh Thu Tháng               │
│                                │
│  ₫ 2,340,000,000               │  ← DM Mono, 3xl, Cool White
│            ↑ +12.4% vs T3     │  ← sm, Teal Success
│                                │
│  ━━━━━━━━━━━━━━━━━━  78% KPI  │  ← Progress Teal
└────────────────────────────────┘

Style: Nền card (#1B2E3D), border-l-4 màu Teal (#87CBB9), padding 24px
Border: 1px solid #2A4355
Hover: translateY -2px + shadow deeper (navy shadow)
```

### 5.2 Data Table (Inventory, Orders)

- Header: Nền đậm hơn card (#142433), text muted, font DM Sans 13px Semibold
- Row: Zebra striping nhẹ (rgba(135,203,185,0.02))
- Row hover: Background Teal cực nhạt (rgba(135,203,185,0.05))
- Sticky header khi scroll

### 5.3 Form Inputs

```
Label (DM Sans 13px, text-muted #8AAEBB)
┌─────────────────────────────────────┐
│  Tên sản phẩm                    ↓ │  ← Nền #142433, border #2A4355
└─────────────────────────────────────┘
Focus: Border màu Teal (#87CBB9) + glow nhẹ (rgba(135,203,185,0.2))
Error: Border Burgundy + text lỗi bên dưới
```

- Input height tối thiểu **44px** (WCAG touch target)
- Font size **16px** tối thiểu trên mobile (tránh iOS auto-zoom)

### 5.4 Action Buttons

```
Primary:    Nền Teal (#87CBB9), text Navy đậm (#0A1926), font Semibold
            → Cảm giác bấm vào sự tươi mới, hiện đại
Secondary:  Border Teal, nền trong suốt, text Teal
Danger:     Nền Burgundy (#8B1A2E), text Cool White
Ghost:      Không nền, không border — chỉ text Teal
```

- Tất cả button: `rounded-md` (6px) — Sharp nhưng không cắt góc hoàn toàn
- Padding: `px-5 py-2.5` chuẩn, `py-3` cho mobile

### 5.5 Status Badge

```
PAID / ACTIVE / DELIVERED:   Nền Teal nhạt rgba(135,203,185,0.15), text Teal (#87CBB9)
PENDING / IN_TRANSIT:         Nền Amber nhạt rgba(212,168,83,0.15), text Amber (#D4A853)
DRAFT / INACTIVE:             Nền xám rgba(74,106,122,0.2), text muted (#8AAEBB)
ERROR / OVERDUE / REJECTED:  Nền Burgundy nhạt rgba(139,26,46,0.2), text Burgundy (#8B1A2E)
```

---

## 6. Mobile-First Priority Screens

### 6.1 Shipper — Delivery Manifest
- **Top App Bar:** Navy đậm (#1A4363) — mang "cánh cửa cửa hàng" đi theo
- **CTA Button:** Teal đầy, 56px tall, full width

### 6.2 Thủ Kho — Pick List
- **Location Badge:** Teal sáng (#87CBB9) — nổi bật trong bóng tối hầm rượu
- **Scan Button:** Teal với icon camera nổi bật

---

## 7. Micro-interactions & Animation

### Nguyên Tắc Animation Cho LY's Cellars
- **Purposeful only** — Không animate cho có
- **Luxury pace** — 200-350ms, không vội vàng như fintech
- **Ease-out chủ yếu** — Vào nhẹ nhàng, dừng chắc
- **GPU-only** — Chỉ dùng `transform` và `opacity`

### Các Animation Cụ Thể

| Sự kiện | Animation | Duration |
|---|---|---|
| Menu sidebar mở/đóng | Width transition + fade labels | 200ms ease-out |
| Table row hover | Background Teal fade | 100ms |
| Card hover | Translatey -2px + navy shadow | 200ms ease-out |
| KPI số thay đổi | Counter animation (count up) | 800ms ease-out |
| Modal mở | Scale 0.95→1 + fade | 200ms ease-out |
| Button loading | Spinner fade in, no resize | 150ms |
| Toast notification | Slide in từ phải | 250ms ease-out |
| Loading (Wine Fill) | Teal đổ vào ly từ dưới lên | 1200ms ease-in-out |

### Logo Loading State (Đặc biệt)
Khi dữ liệu tải: SVG chiếc ly rỗng → màu Teal đổ đầy từ dưới lên theo đường uốn lượn của logo.

---

## 8. Icons & Imagery

### Icon Style
- **Dùng Lucide React** — Stroke 1.5px, consistent
- Size: 16px (inline), 20px (button), 24px (navigation), 32px (feature icons)
- Màu icon Active: Teal (#87CBB9), Default: Steel Muted (#8AAEBB)

### Product Images
- Aspect ratio cố định `3:4` (Portrait — chuẩn cho chai rượu)
- Fallback: Wine bottle silhouette SVG màu #4A6A7A

---

## 9. Accessibility

- **WCAG AA** — Teal (#87CBB9) trên Navy (#0A1926) đạt contrast ratio ~7.2:1 ✅
- **Focus visible:** Ring 2px màu Teal cho keyboard navigation
- **Touch targets:** Tối thiểu 44×44px
- **Loading states:** Skeleton screens màu #1B2E3D thay vì spinner

---

## 10. Design Tokens (Tailwind v4 CSS Variables)

```css
/* globals.css — @theme block */
@theme {
  /* ── LY's Cellars — Oceanic Cellar Design Tokens ── */

  /* Core Backgrounds */
  --color-lys-bg:       #0A1926;   /* Deep Sea Navy */
  --color-lys-surface:  #142433;   /* Midnight Teal */
  --color-lys-card:     #1B2E3D;   /* Steel Blue */
  --color-lys-border:   #2A4355;   /* Deep Ocean */

  /* Brand Accents */
  --color-lys-teal:     #87CBB9;   /* Logo Teal — LINH HỒN */
  --color-lys-teal-light: #A5DED0; /* Mint Light — Hover */
  --color-lys-navy:     #1A4363;   /* Showroom Door Navy */
  --color-lys-wine:     #8B1A2E;   /* Burgundy Red — Error/Alert */
  --color-lys-amber:    #D4A853;   /* Amber Warm — Warning */

  /* Text */
  --color-lys-ivory:    #E8F1F2;   /* Cool White */
  --color-lys-muted:    #8AAEBB;   /* Steel Muted */
  --color-lys-dim:      #4A6A7A;   /* Deep Muted */

  /* Semantic */
  --color-success:      #5BA88A;   /* Teal Success */
  --color-warning:      #D4A853;   /* Amber Warning */
  --color-error:        #8B1A2E;   /* Burgundy Error */
  --color-info:         #4A8FAB;   /* Ocean Info */

  /* Typography */
  --font-display: "Cormorant Garamond", Georgia, serif;
  --font-sans:    "DM Sans", system-ui, sans-serif;
  --font-mono:    "DM Mono", Menlo, monospace;

  /* Radius — Sharp/Luxury */
  --radius:       6px;
  --radius-sm:    4px;
  --radius-lg:    10px;
  --radius-full:  9999px;
}
```

---

## 11. Tailwind Config Reference (Nếu cần file cũ)

```javascript
// tailwind.config.js - LY's Cellars Edition
module.exports = {
  theme: {
    extend: {
      colors: {
        lys: {
          bg:      '#0A1926',
          surface: '#142433',
          card:    '#1B2E3D',
          border:  '#2A4355',
          teal:    '#87CBB9',
          'teal-light': '#A5DED0',
          navy:    '#1A4363',
          ivory:   '#E8F1F2',
          muted:   '#8AAEBB',
          dim:     '#4A6A7A',
          wine:    '#8B1A2E',
          amber:   '#D4A853',
        }
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
        mono:    ['DM Mono', 'Menlo', 'monospace'],
      }
    }
  }
}
```

---

## 12. Google Fonts Import

```html
<!-- app/layout.tsx <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

---

## 13. Chuyển Đổi Token (Migration Reference)

| Token cũ (Cave Noir) | Token mới (Oceanic Cellar) | Ý nghĩa |
|---|---|---|
| `#0F0A08` wine-bg | `#0A1926` lys-bg | Đen ấm → Navy sâu |
| `#1A1209` wine-surface | `#142433` lys-surface | Nâu đen → Midnight Teal |
| `#211810` wine-card | `#1B2E3D` lys-card | Chocolate → Steel Blue |
| `#3D2B1F` wine-border | `#2A4355` lys-border | Nâu ấm → Deep Ocean |
| `#C4963A` wine-gold | `#87CBB9` lys-teal | Vàng đồng → **Teal Logo** |
| `#D4AF65` wine-gold-light | `#A5DED0` lys-teal-light | Vàng sáng → Mint Light |
| `#8B1A2E` wine-garnet | `#8B1A2E` lys-wine | Garnet → Burgundy (GIỮ NGUYÊN) |
| `#F5EDD8` wine-ivory | `#E8F1F2` lys-ivory | Ivory ấm → Cool White |
| `#A89880` wine-muted | `#8AAEBB` lys-muted | Nâu nhạt → Steel Muted |
| `#6B5A4E` wine-dim | `#4A6A7A` lys-dim | Nâu rất nhạt → Deep Muted |

---
*Design System v2.0 — LY's Cellars "Oceanic Cellar" Aesthetic | 2026-03-04*
*Inspired by the Mediterranean Navy door of LY's Cellars showroom, số 12.*
