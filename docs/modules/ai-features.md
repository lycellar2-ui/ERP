# AI Features — Tính Năng AI & Quản Lý Prompt & API Key
**Module:** `AI` | Người dùng: IT_ADMIN, CEO | Ưu tiên: 🟡 P2

> **Quyết định kỹ thuật:** Dùng **Google Gemini** làm LLM chính (Gemini 2.0 Flash / Gemini 1.5 Pro).
> Google Vision API cho OCR. Kiến trúc hỗ trợ đa provider — Có thể thêm Anthropic/OpenAI sau.

---

## 1. Kiến Trúc Tổng Thể

```
┌─────────────────────────────────────────────────────────┐
│               AI Configuration (Admin UI)                │
│                                                          │
│   ┌──────────────────┐    ┌──────────────────────────┐  │
│   │  Prompt Library  │    │   API Key Vault          │  │
│   │  (Quản lý Prompt)│    │   (Supabase DB, AES-256) │  │
│   └────────┬─────────┘    └───────────┬──────────────┘  │
└────────────┼──────────────────────────┼─────────────────┘
             │                          │
┌────────────▼──────────────────────────▼─────────────────┐
│                   AI Service Layer                        │
│  (Server-side only — Key never exposed to browser)        │
│                                                          │
│   resolvePrompt(templateId, vars) → filled prompt        │
│   callAi(service, model, prompt) → response              │
│   logUsage(keyId, feature, tokens, cost)                 │
└────────────┬─────────────────────────────────────────────┘
             │  Gọi API
    ┌─────────┴─────────────────────────────────────┐
    │                                               │
┌───▼───────────────────┐   ┌───────────────────┐  ┌───────────────────┐
│ Google Gemini API      │   │ Google Vision API │  │ (Optional future) │
│ Gemini 2.0 Flash       │   │ OCR / PDF scan    │  │ Anthropic Claude  │
│ Gemini 1.5 Pro         │   │                   │  │ OpenAI GPT-4o     │
└───────────────────────┘   └───────────────────┘  └───────────────────┘
```

---

## 2. Danh Sách Đầy Đủ Tính Năng AI

Wine ERP có **9 tính năng AI** phân thành 3 nhóm:

### Nhóm A: Tự Động Hóa Dữ Liệu (Automation)

| # | Feature | Model | Mô Tả |
|---|---|---|---|
| A1 | **OCR Tờ Khai Hải Quan** | Gemini 2.0 Flash | Đọc PDF tờ khai → extract số thuế tự động |
| A2 | **OCR Hóa Đơn Logistics** | Gemini 2.0 Flash | Đọc invoice forwarder → điền Landed Cost |
| A3 | **Auto Nhận Dạng Sản Phẩm** | Gemini Vision | Chụp ảnh nhãn chai → tìm SKU trong hệ thống |

### Nhóm B: Phân Tích & Hỗ Trợ Quyết Định (Analytics)

| # | Feature | Model | Mô Tả |
|---|---|---|---|
| B1 | **Tóm Tắt Báo Cáo CEO** | Gemini 1.5 Pro | Tổng hợp P&L tháng → paragraph ngắn gọn |
| B2 | **Phát Hiện Bất Thường** | Gemini 1.5 Flash | Alert khi số liệu bất thường (Margin âm, đơn hàng to bất thường) |
| B3 | **Dự Báo Nhu Cầu Nhập Hàng** | Gemini 1.5 Pro | Phân tích trend bán hàng → gợi ý PO tiếp theo |
| B4 | **Gợi Ý Giá Bán Tối Ưu** | Gemini 1.5 Flash | Dựa vào Landed Cost + market price → đề xuất giá |

### Nhóm C: Nội Dung & UX (Content)

| # | Feature | Model | Mô Tả |
|---|---|---|---|
| C1 | **Sinh Mô Tả Sản Phẩm** | Gemini 1.5 Pro | Tasting notes, mô tả chai rượu tiếng Việt/Anh |
| C2 | **Smart Search** | Gemini Embedding | Tìm kiếm ngữ nghĩa ("rượu vang đỏ nhẹ giá tầm trung") |

---

## 3. Chi Tiết Từng Tính Năng

### A1. OCR Tờ Khai Hải Quan

**Bài toán:** Agent hải quan upload PDF tờ khai → Kế toán phải gõ tay số liệu vào ERP mất 30–60 phút/lô.

**Giải pháp:**
```
Agent upload PDF tờ khai
     ↓
Google Vision API → trích xuất text (OCR)
     ↓
Gemini 2.0 Flash → parse text → JSON chuẩn
     ↓
Hệ thống auto điền:
  - Số tờ khai
  - Ngày thông quan
  - Thuế NK / TTĐB / VAT từng dòng hàng
     ↓
Kế toán Review & Confirm (1 click nếu đúng)
```

**Tiết kiệm:** ~45 phút/lô hàng. Giảm sai sót nhập tay.

---

### A2. OCR Hóa Đơn Logistics

**Bài toán:** Forwarder/cảng gửi PDF invoice phí — Kế toán nhập tay vào Landed Cost.

**Giải pháp:** Tương tự A1, extract:
- Tên chi phí (Ocean Freight, THC, D/O fee...)
- Số tiền, ngoại tệ
- Ngày hóa đơn, số invoice

Auto map vào `LandedCostLine` đúng loại chi phí.

---

### A3. Auto Nhận Dạng Sản Phẩm Qua Ảnh

**Bài toán:** Nhân viên kho nhận hàng — Cần xác định SKU nhanh khi barcode bị hỏng/không đọc được.

**Giải pháp:**
```
Chụp ảnh nhãn chai (qua camera điện thoại)
     ↓
Gemini Vision phân tích ảnh
     ↓
Trả về: "Château Margaux 2019, 750ml"
     ↓
Hệ thống tìm trong MDM → confirm SKU
```

---

### B1. Tóm Tắt Báo Cáo Tháng Gửi CEO (Monthly Executive Summary)

**Bài toán:** CEO nhận báo cáo Excel dày — Không có thời gian đọc hết.

**Giải pháp:** Mỗi đầu tháng, hệ thống tự động:

```
1. Query số liệu tháng trước (Revenue, Margin, AR aging, Top SKU...)
2. Gemini 1.5 Pro → Sinh executive summary 150-200 từ tiếng Việt
3. Gửi email CEO + Hiển thị trên Dashboard
```

**Output mẫu:**
```
📊 Báo Cáo Tóm Tắt Tháng 02/2026

Tháng 02 đạt doanh thu ₫2.34 tỷ (+12.4% MoM), tuy nhiên Gross Margin
giảm nhẹ còn 28.6% do biến động tỷ giá USD/VND tăng 1.8%.

Điểm sáng: Kênh HORECA tăng trưởng mạnh 18%, đặc biệt từ các hotel
5 sao mới ký hợp đồng. Top SKU: Château Margaux 2019 (42 chai), 
Opus One 2020 (28 chai).

Cần chú ý: 3 khách hàng có AR quá hạn >60 ngày tổng ₫380 triệu.
Tồn kho Champagne cao bất thường (180 ngày tồn), nên xem xét promo.

Đề xuất hành động:
• Gọi điện 3 KH AR quá hạn trước 10/03
• Tạo campaign tasting Champagne cho tháng 3
• Xem xét tăng nhập Bordeaux do tốc độ bán tốt
```

---

### B2. Phát Hiện Bất Thường (Anomaly Detection)

**Bài toán:** Hệ thống cần tự phát hiện các số liệu "lạ" mà con người có thể bỏ qua.

**Các pattern phát hiện:**

| Bất thường | Trigger | Alert |
|---|---|---|
| Margin âm | SO Line có margin < 0% | 🔴 Cảnh báo CEO + không cho xuất |
| Đơn hàng to bất thường | SO value > 3× average của KH đó | 🟡 Yêu cầu xác nhận thêm |
| Discount bất thường | % chiết khấu > threshold | 🔴 Yêu cầu CEO duyệt |
| Giá vốn thay đổi đột ngột | Landed cost/chai tăng >20% so lô trước | 🟡 Alert cho Finance |
| Tồn kho âm | qty_available < 0 | 🔴 Block xuất kho |
| AP quá hạn | NCC chưa được trả sau 90 ngày | 🟡 Alert cho Kế toán |

**Gemini phân tích** context phức tạp hơn simple rules:
> "3 đơn hàng từ cùng 1 KH trong 24h, tổng giá trị gấp 5× lịch sử mua của KH này — Có thể là order thay đổi hay rủi ro gian lận?"

---

### B3. Dự Báo Nhu Cầu Nhập Hàng (Demand Forecast)

**Bài toán:** Quyết định nhập bao nhiêu chai mỗi lô là bài toán khó — Nhập ít thì hết hàng bán, nhập nhiều thì đọng vốn.

**Input cho AI:**
- Lịch sử bán 12 tháng qua theo SKU
- Tồn kho hiện tại
- Đơn hàng đang chờ (backlog)
- Seasonality (mùa Noel, Tết, Valentine)
- Thông tin container đang về

**Output:**
```
📦 Gợi Ý Nhập Hàng — Tháng 04/2026

Cần đặt PO trước 15/03 cho lô về tháng 4:

SKU                    Tồn hiện tại  Dự báo bán T4  Đề xuất nhập
Château Pétrus 2018    12 chai       18 chai         24 chai (+buffer 30%)
Opus One 2020          45 chai       30 chai         0 (đủ hàng)
Krug MV Champagne      8 chai        25 chai         36 chai (THIẾU HỤT!)
Barolo Giacomo 2017    3 chai        8 chai          12 chai

⚠️ Krug Champagne cần đặt KHẨN vì thời gian vận chuyển 45 ngày
```

---

### B4. Gợi Ý Giá Bán Tối Ưu (Price Suggestion)

Kết hợp với CST module (Costing):

```
Landed Cost/chai + Margin target theo kênh
     ↓
Gemini phân tích thêm:
  - Giá cạnh tranh từ market price table (WineSearcher data)
  - Lịch sử giá đã bán cho từng KH
  - Elasticity: KH này nhạy cảm giá không?
     ↓
Đề xuất giá + Giải thích tại sao
```

**Output:**
```
Opus One 2020 — Giá đề xuất: ₫5,200,000/chai (HORECA)

Lý do: Landed cost ₫2,890,000. Margin mục tiêu 44%.
Market price WineSearcher: $280 ≈ ₫7,140,000 (giá thị trường).
Giá cạnh tranh với 2 nhà phân phối khác khoảng ₫4,800,000–5,500,000.
→ ₫5,200,000 là mức tối ưu: Margin tốt + Competitive.
```

---

### C1. Sinh Mô Tả Sản Phẩm (Product Description)

**Bài toán:** Nhập hàng mới về cần viết tasting notes, mô tả sản phẩm bằng 2 ngôn ngữ — Tốn thời gian.

**Input:** Tên sản phẩm, Vintage, Vùng, ABV, Giải thưởng, Winemaker notes

**Output:**
```
Tiếng Việt:
"Château Pétrus 2018 là biểu tượng của vùng Pomerol với 95% Merlot.
Màu đỏ ruby sẫm, hương thơm mãnh liệt của mận chín, chocolate đen
và gỗ tuyết tùng. Vị tròn đầy, tanin mịn màng, kết thúc dài và thanh
lịch. Thích hợp thưởng thức 2025-2045."

English:
"A masterpiece from Pomerol, the 2018 Pétrus dazzles with its inky
ruby hue and explosive bouquet of ripe plum, dark chocolate, and
cedarwood. Full-bodied with velvety tannins — drink 2025-2045."
```

---

### C2. Smart Search — Tìm Kiếm Ngữ Nghĩa

**Bài toán:** Nhân viên sales cần tìm "rượu vang đỏ nhẹ giá tầm trung cho nhà hàng Nhật" — Search thông thường không hiểu được.

**Giải pháp:** Gemini Embedding + Vector Search (Supabase pgvector)

```
User nhập: "rượu vang đỏ nhẹ giá tầm trung cho nhà hàng Nhật"
     ↓
Gemini Embedding → Vector
     ↓
pgvector similarity search trong Product catalog
     ↓
Kết quả: Pinot Noir Burgundy, Chianti Classico, Barbera d'Asti
(Các loại nhẹ, tannin thấp, phù hợp ẩm thực Châu Á)
```

---

## 4. Prompt Management System (Thư Viện Prompt)

### Tại Sao Cần Quản Lý Prompt?

- **Không hardcode:** Thay đổi prompt mà không cần sửa code, không cần redeploy
- **Phân quyền:** IT Admin viết prompt kỹ thuật
- **Version control:** Lịch sử thay đổi, rollback khi cần
- **A/B Testing:** Thử 2 version, chọn cái tốt hơn
- **Variables:** Inject dữ liệu thực tế vào `{{biến}}`

### Database Schema

```prisma
model AiPromptTemplate {
  id                 String           @id @default(cuid())
  name               String           // "OCR Tờ Khai Hải Quan"
  slug               String           @unique // "customs-ocr"
  description        String?
  feature            AiFeature
  service            AiService        @default(GOOGLE_GEMINI)
  model              AiModel          @default(GEMINI_20_FLASH)
  systemPrompt       String
  userPromptTemplate String
  variables          Json             // [{name, description, required}]
  temperature        Float            @default(0.3)
  maxTokens          Int              @default(2000)
  isActive           Boolean          @default(true)
  version            Int              @default(1)
  versions           AiPromptVersion[]
  runs               AiPromptRun[]
  createdBy          String
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
  @@map("ai_prompt_templates")
}
```

### Prompt Templates Đã Chuẩn Bị

| Slug | Feature | Model | Temperature |
|---|---|---|---|
| `customs-ocr` | OCR_CUSTOMS | Gemini 2.0 Flash | 0.0 |
| `logistics-invoice-ocr` | OCR_INVOICE | Gemini 2.0 Flash | 0.0 |
| `product-image-identify` | PRODUCT_IDENTIFY | Gemini Vision | 0.1 |
| `ceo-monthly-summary` | REPORT_SUMMARY | Gemini 1.5 Pro | 0.4 |
| `anomaly-alert` | ANOMALY_DETECTION | Gemini 1.5 Flash | 0.2 |
| `demand-forecast` | DEMAND_FORECAST | Gemini 1.5 Pro | 0.3 |
| `price-suggestion` | PRICE_SUGGESTION | Gemini 1.5 Flash | 0.2 |
| `product-description-vi` | PRODUCT_DESCRIPTION | Gemini 1.5 Pro | 0.7 |
| `product-description-en` | PRODUCT_DESCRIPTION | Gemini 1.5 Pro | 0.7 |

---

## 5. API Key Vault — Bảo Mật AES-256

### Database Schema

```prisma
model ApiKeyConfig {
  id              String      @id @default(cuid())
  service         AiService
  alias           String      // "Gemini Production", "Vision API"
  keyEncrypted    String      // AES-256-GCM encrypted
  keyIv           String      // Initialization Vector
  keyPreview      String      // "AIza***XYZ9" (display only)
  isActive        Boolean     @default(true)
  addedBy         String
  lastTestedAt    DateTime?
  lastTestSuccess Boolean?
  monthlyBudgetUsd Decimal?   // Cảnh báo khi vượt budget
  runs            AiPromptRun[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  @@map("api_key_configs")
}
```

### AI Service Layer — Google Gemini

```typescript
// lib/ai-service.ts

import { GoogleGenerativeAI } from '@google/generative-ai'
import { decryptApiKey } from './encryption'
import { prisma } from './prisma'

// npm install @google/generative-ai

export async function callGemini(
  templateSlug: string,
  vars: Record<string, string>
): Promise<string> {
  const template = await prisma.aiPromptTemplate.findUnique({
    where: { slug: templateSlug, isActive: true }
  })
  if (!template) throw new Error(`Template not found: ${templateSlug}`)

  // Render template — Replace {{variables}}
  const userPrompt = template.userPromptTemplate.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => vars[key] ?? `[${key} not provided]`
  )

  // Lấy API key từ DB (encrypted) hoặc env var
  const keyConfig = await prisma.apiKeyConfig.findFirst({
    where: { service: 'GOOGLE_GEMINI', isActive: true }
  })
  const apiKey = keyConfig
    ? decryptApiKey(keyConfig.keyEncrypted, keyConfig.keyIv)
    : process.env.GOOGLE_GEMINI_API_KEY!

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: template.model,           // "gemini-2.0-flash", "gemini-1.5-pro"
    systemInstruction: template.systemPrompt,
  })

  const start = Date.now()
  try {
    const result = await model.generateContent(userPrompt)
    const output = result.response.text()

    // Log usage
    await prisma.aiPromptRun.create({
      data: {
        templateId: template.id,
        keyId: keyConfig?.id ?? 'env-fallback',
        inputVars: vars,
        response: output,
        tokensInput: result.response.usageMetadata?.promptTokenCount ?? 0,
        tokensOutput: result.response.usageMetadata?.candidatesTokenCount ?? 0,
        durationMs: Date.now() - start,
        success: true,
      }
    })

    return output
  } catch (error: any) {
    await prisma.aiPromptRun.create({
      data: {
        templateId: template.id,
        keyId: keyConfig?.id ?? 'env-fallback',
        inputVars: vars,
        success: false,
        errorMsg: error.message,
        durationMs: Date.now() - start,
      }
    })
    throw error
  }
}

// Cho OCR / Vision (ảnh hoặc PDF)
export async function callGeminiVision(
  templateSlug: string,
  imageBase64: string,
  mimeType: string,   // "image/jpeg" | "application/pdf"
  vars: Record<string, string> = {}
): Promise<string> {
  const template = await prisma.aiPromptTemplate.findUnique({
    where: { slug: templateSlug, isActive: true }
  })
  // ... tương tự với inlineData part
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent([
    { text: template!.userPromptTemplate },
    { inlineData: { mimeType, data: imageBase64 } }
  ])
  return result.response.text()
}
```

---

## 6. Enums Cập Nhật (Prisma Schema)

```prisma
enum AiService {
  GOOGLE_GEMINI          // ← Primary LLM
  GOOGLE_VISION          // ← OCR
  ANTHROPIC              // ← Optional future
  OPENAI                 // ← Optional future
}

enum AiModel {
  GEMINI_20_FLASH        // ← Fast, cheap, OCR + general (PRIMARY)
  GEMINI_15_PRO          // ← Powerful, complex reasoning
  GEMINI_15_FLASH        // ← Fast tier
  GEMINI_15_FLASH_8B     // ← Lightest, cheapest
  GEMINI_EMBEDDING       // ← Smart Search embedding
  CLAUDE_3_SONNET        // ← Optional
  GPT_4O                 // ← Optional
}

enum AiFeature {
  OCR_CUSTOMS            // Đọc tờ khai hải quan
  OCR_INVOICE            // Đọc hóa đơn logistics
  PRODUCT_IDENTIFY       // Nhận dạng sản phẩm qua ảnh
  REPORT_SUMMARY         // Tóm tắt báo cáo tháng
  ANOMALY_DETECTION      // Phát hiện bất thường
  DEMAND_FORECAST        // Dự báo nhu cầu nhập hàng
  PRICE_SUGGESTION       // Gợi ý giá bán
  PRODUCT_DESCRIPTION    // Sinh mô tả tasting notes
  SMART_SEARCH           // Tìm kiếm ngữ nghĩa
}
```

---

## 7. Monitoring & Cost Control

### Dashboard AI Usage (Admin)

```
┌─────────────────────────────────────────────────────────┐
│  📊 AI Usage — Tháng 03/2026           [Export Excel]   │
├────────────────┬────────┬──────────┬───────┬────────────┤
│ Feature        │ Calls  │ Tokens   │ Cost  │ Thành công │
├────────────────┼────────┼──────────┼───────┼────────────┤
│ OCR Customs    │ 18     │ 342,000  │ $1.71 │ 94.4%      │
│ CEO Summary    │ 1      │  8,500   │ $0.13 │ 100%       │
│ Product Desc   │ 12     │ 96,000   │ $0.48 │ 100%       │
│ Anomaly Det.   │ 847    │ 254,100  │ $0.25 │ 99.8%      │
├────────────────┼────────┼──────────┼───────┼────────────┤
│ TỔNG           │        │          │ $2.57 │ 99.2%      │
└────────────────┴────────┴──────────┴───────┴────────────┘
Budget tháng: $20   Đã dùng: $2.57 (12.8%)   Còn lại: $17.43
```

### Budget Alert
- Cấu hình `monthlyBudgetUsd` cho mỗi API key
- Alert CEO + IT_ADMIN khi đạt 80% budget
- Auto-disable key khi vượt 100% (để không cháy tiền)

---

## 8. Security Rules — KHÔNG BAO GIỜ Vi Phạm

| ❌ KHÔNG | ✅ NÊN |
|---|---|
| Return plain API key về client | Chỉ return `preview` (masked) |
| Import `encryption.ts` ở Client Component | Chỉ dùng Server Action / API Route |
| Lưu key trong `localStorage` hoặc cookie | Key chỉ tồn tại trong RAM khi gọi AI |
| Log plain key vào console/file | Log chỉ `keyId` và `preview` |
| Commit `.env` lên GitHub | `.env.local` phải có trong `.gitignore` |
| Cho user thường đọc bảng `api_key_configs` | RLS Supabase chặn hoàn toàn |

```sql
-- Supabase RLS — Chỉ service_role mới đọc/ghi được
ALTER TABLE api_key_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct client access"
ON api_key_configs FOR ALL USING (false);
```

---

## 9. Env Vars Cần Thêm

```env
# ─── Google AI ──────────────────────────────────────
GOOGLE_GEMINI_API_KEY=AIza...     # Lấy từ Google AI Studio
GOOGLE_VISION_API_KEY=AIza...     # Google Cloud Vision API
GOOGLE_PROJECT_ID=wine-erp-xxx    # Google Cloud Project

# ─── Encryption (cho API Key Vault) ─────────────────
ENCRYPTION_SECRET=32-char-random-hex-string-here
```

> 💡 **Lấy Gemini API key miễn phí:** [aistudio.google.com](https://aistudio.google.com) → "Get API Key"
> Free tier: 15 RPM, 1 triệu tokens/ngày với Gemini 1.5 Flash — Đủ dùng trong giai đoạn đầu.

---

## 10. Lộ Trình Triển Khai AI

| Phase | Tính Năng | Ưu Tiên |
|---|---|---|
| **Phase 4C** | OCR Tờ Khai (A1) + OCR Logistics Invoice (A2) | 🔴 Cao — Tiết kiệm nhiều nhất |
| **Phase 4D** | Tóm Tắt Báo Cáo CEO (B1) + Anomaly Detection (B2) | 🟡 Quan trọng |
| **Phase 4E** | Sinh Mô Tả Sản Phẩm (C1) + Prompt Library UI | 🟡 |
| **Phase 5** | Smart Search pgvector (C2) + Demand Forecast (B3) + Price AI (B4) | 🟢 Nâng cao |

*Last updated: 2026-03-09 04:00 | Wine ERP v6.4 — Google Gemini 3.1 Pro Primary — 6 AI features live*

---

## 11. 🚀 Implementation Status (2026-03-09)

### Đã triển khai & đang live:

| # | Feature | Status | Model | API Route | Component |
|---|---|---|---|---|---|
| 1 | **AI CEO Briefing** | ✅ Live | Gemini 3.1 Pro | `/api/ceo-summary` | `dashboard/AICeoSummary.tsx` |
| 2 | **AI Purchase Suggestion** | ✅ Live | Gemini 3.1 Pro | `/api/purchase-suggestion` | `procurement/AIPurchaseSuggestion.tsx` |
| 3 | **AI Pipeline Analysis** | ✅ Live | Gemini 3.1 Pro | `/api/pipeline-analysis` | `pipeline/AIPipelineAnalysis.tsx` |
| 4 | **AI CRM Analysis** | ✅ Live | Gemini 3.1 Pro | `/api/crm-analysis` | `crm/AICRMAnalysis.tsx` |
| 5 | **AI Catalog Intelligence** | ✅ Live | Gemini 3.1 Pro | `/api/catalog-analysis` | `products/AICatalogAnalysis.tsx` |
| 6 | **API Key Vault** | ✅ Live | - | `/api/ai/keys` | `ai/VaultUI.tsx` |
| 7 | **AI Admin Toggle** | ✅ Live | - | `/api/ai/config`, `/api/ai/status` | `ai/AIManagementUI.tsx` |
| 8 | **AI Reports History** | ✅ Live | - | `/api/ai/reports` | `ai/AIManagementUI.tsx` |
| 9 | **Active Prompt Editor** | ✅ Live | - | `/api/ai/prompts`, `/api/ai/seed-prompts` | `ai/ActivePromptEditor.tsx` |

### Chi tiết kỹ thuật:

#### 1. AI CEO Briefing (`/api/ceo-summary`)
- **Data sources**: Revenue, P&L, SO count, Margin, AR Aging, Top SKU
- **Output**: Executive summary tiếng Việt cho CEO dashboard
- **maxTokens**: 4096 | **temperature**: 0.4
- **Hiển thị**: Chỉ CEO role, trên dashboard chính

#### 2. AI Purchase Suggestion (`/api/purchase-suggestion`)
- **Data sources**: StockLot (tồn kho) + SalesOrderLine (3 tháng gần nhất)
- **Phân tích**: Sales velocity, weeks of supply, landed cost
- **Output**: Báo cáo 4 tier urgency (🔴 Cần nhập ngay, 🟡 Sắp hết, 🟢 Đủ, ⚠️ Tồn cao)
- **maxTokens**: 8192 | **temperature**: 0.4

#### 3. AI Pipeline Analysis (`/api/pipeline-analysis`)
- **Data sources**: SalesOpportunity (all stages) + Customer + User
- **Phân tích**: Pipeline health score, velocity per stage, stale deals, win rate, concentration risk
- **Output**: 7-section report (Tổng quan, Top 5 deals, Velocity, Cảnh báo, Coaching, Dự báo, Hành động)
- **maxTokens**: 8192 | **temperature**: 0.4
- **DB Prompt slug**: `pipeline-analysis`

#### 4. AI CRM Analysis (`/api/crm-analysis`)
- **Data sources**: Customer (full profile) + SalesOrder (revenue) + AR (công nợ) + Complaints + Opportunities + Activities
- **Phân tích**: CRM Health Score, Customer tier (PLATINUM/GOLD/SILVER/BRONZE), churning detection (>60 ngày không mua), revenue MoM growth, AR risk concentration
- **Output**: 7-section CRM Director report (Sức khỏe CRM, Top KH, Churning/Rủi ro, Công nợ, Xu hướng, Chiến lược, Wine Preference Insights)
- **maxTokens**: 8192 | **temperature**: 0.4
- **DB Prompt slug**: `crm-analysis`

#### 5. AI Catalog Intelligence (`/api/catalog-analysis`)
- **Data sources**: Product (enriched: sales/stock/pricing/quotations/awards) + Supplier (enriched: spending/PO/contracts/AP) + Producer + Region + Appellation
- **Phân tích**: Portfolio Health Score, top performers, sản phẩm chưa bán, nghiên cứu thị trường VN, supplier concentration, pricing/margin insights
- **Output**: 7-section Wine Portfolio Director report (Tổng quan, Top Performers, Sản phẩm mới, Thị trường, NCC, Pricing, Chiến lược)
- **maxTokens**: 8192 | **temperature**: 0.5
- **DB Prompt slug**: `catalog-analysis`
- **Đặc biệt**: Kết hợp dữ liệu có & không có sales data, market intelligence từ AI knowledge

#### 6. AI Admin System (3 components)

**6a. AI System Toggle (`/api/ai/config` + `/api/ai/status`)**
- **Model DB**: `AiSystemConfig` (singleton) — `aiEnabled`, `allowedModules` JSON array
- **Client hook**: `useAiStatus('module')` → auto-hide AI panels khi disabled
- **Server check**: `isModuleAiEnabled('pipeline|crm|catalog')` → 403 khi disabled
- **UI**: Master ON/OFF toggle + 5 module cards (Pipeline, CRM, Catalog, CEO, Product Desc) với green dot indicators
- **Dual-layer protection**: Client hides UI + Server rejects API calls

**6b. AI Reports History (`/api/ai/reports`)**
- **Model DB**: `AiReport` — module, title, analysis (Text), stats (JSON), isPinned, isArchived
- **Actions**: Save (từ 3 AI panels) → Pin → Archive → Delete
- **UI**: Scrollable list, filter by module tabs, expand inline viewer, pinned reports sort lên đầu

**6c. Active Prompt Editor (`/api/ai/prompts` + `/api/ai/seed-prompts`)**
- **Model DB**: `AiPromptTemplate` — slug (unique), systemPrompt, userTemplate, temperature, maxTokens
- **Flow**: `resolvePromptTemplate(slug)` → DB template hoặc hardcoded fallback
- **Template variable**: `{{data}}` — hệ thống tự thay bằng dữ liệu thực (pipeline deals, customer profiles, product catalog)
- **Seed**: POST `/api/ai/seed-prompts` → tạo 3 prompt mặc định (idempotent upsert)
- **UI**: 3 AI feature cards với inline expand/collapse editor cho systemPrompt, userTemplate, temperature, maxTokens

### API Routes Reference (11 routes):

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/pipeline-analysis` | Run pipeline analysis |
| POST | `/api/crm-analysis` | Run CRM analysis |
| POST | `/api/catalog-analysis` | Run catalog analysis |
| POST | `/api/ceo-summary` | CEO briefing |
| POST | `/api/purchase-suggestion` | Purchase suggestions |
| GET | `/api/ai/status` | Check AI enabled + allowed modules |
| PUT | `/api/ai/config` | Update AI system config |
| POST | `/api/ai/reports` | Save AI report |
| PUT | `/api/ai/reports/[id]/pin` | Toggle pin |
| PUT | `/api/ai/reports/[id]/archive` | Archive report |
| DELETE | `/api/ai/reports/[id]` | Delete report |
| POST | `/api/ai/seed-prompts` | Seed default prompt templates |
| PUT | `/api/ai/prompts` | Update prompt template |

### Schema changes (Session 2026-03-09):
```prisma
model AiReport {
    id         String   @id @default(cuid())
    module     String
    title      String
    analysis   String   @db.Text
    stats      Json?
    isPinned   Boolean  @default(false)
    isArchived Boolean  @default(false)
    createdAt  DateTime @default(now())
}

model AiSystemConfig {
    id                 String   @id @default("singleton")
    aiEnabled          Boolean  @default(true)
    allowedModules     Json     @default("[\"pipeline\",\"crm\",\"catalog\",\"ceo\",\"product-desc\"]")
    defaultTemperature Float    @default(0.5)
    defaultMaxTokens   Int      @default(4096)
    updatedAt          DateTime @updatedAt
}

model SalesOpportunity {
    // ... existing fields ...
    previousStage  OpportunityStage?  // Track pipeline direction
    stageChangedAt DateTime @default(now()) // For velocity calculation
}
```

### Seed scripts:
- `scripts/seed-pipeline.ts` — 24 pipeline deals with stage timing data
- POST `/api/ai/seed-prompts` — 3 default prompt templates (pipeline, crm, catalog)


