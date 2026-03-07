# 📁 File Storage Implementation Plan — Wine ERP

> **Ngày tạo:** 2026-03-07
> **Trạng thái:** 📋 Chờ triển khai
> **Phương án:** ImgBB (ảnh) + Supabase Storage (chứng từ)

---

## Tổng Quan Kiến Trúc

```
┌─────────────────────────────────────────────────────┐
│                    Wine ERP                          │
│                                                     │
│  ┌──────────────┐         ┌──────────────────────┐  │
│  │  Ảnh SP/UI   │         │  Hợp đồng / Chứng từ │  │
│  │  (public)    │         │  (private/protected)  │  │
│  └──────┬───────┘         └──────────┬───────────┘  │
│         │                            │              │
│         ▼                            ▼              │
│  ┌──────────────┐         ┌──────────────────────┐  │
│  │   ImgBB API  │         │  Supabase Storage    │  │
│  │   (free)     │         │  (free 1GB)          │  │
│  └──────┬───────┘         └──────────┬───────────┘  │
│         │                            │              │
│         ▼                            ▼              │
│    URL → DB field              URL → DB field       │
│  (Product.imageUrl)       (Contract.documentUrl)    │
└─────────────────────────────────────────────────────┘
```

---

## Phần 1: ImgBB — Ảnh Sản Phẩm

### 1.1 Đăng ký API Key

1. Truy cập: https://api.imgbb.com/
2. Đăng nhập / Tạo tài khoản (miễn phí)
3. Lấy API Key từ dashboard
4. Thêm vào `.env.local`:

```env
IMGBB_API_KEY=your_api_key_here
```

> ⚠️ **Nhớ thêm vào Vercel Environment Variables khi deploy.**

### 1.2 Tạo Upload Service

**File:** `src/lib/imgbb.ts`

```typescript
'use server'

const IMGBB_API = 'https://api.imgbb.com/1/upload'

export type ImgBBResponse = {
  success: boolean
  data?: {
    id: string
    url: string          // Link ảnh gốc
    display_url: string  // Link hiển thị
    thumb: { url: string } // Thumbnail
    delete_url: string   // Link xóa (lưu vào DB để xóa sau)
  }
  error?: { message: string }
}

/**
 * Upload ảnh lên ImgBB
 * @param base64Image - Base64 encoded image (không có prefix data:image/...)
 * @param name - Tên file (optional)
 * @returns ImgBBResponse với URL ảnh
 */
export async function uploadToImgBB(
  base64Image: string,
  name?: string
): Promise<ImgBBResponse> {
  const apiKey = process.env.IMGBB_API_KEY
  if (!apiKey) throw new Error('IMGBB_API_KEY not configured')

  // Loại bỏ prefix base64 nếu có
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '')

  const formData = new FormData()
  formData.append('key', apiKey)
  formData.append('image', cleanBase64)
  if (name) formData.append('name', name)

  const response = await fetch(IMGBB_API, {
    method: 'POST',
    body: formData,
  })

  return response.json()
}

/**
 * Upload file từ FormData (dùng trong Server Action)
 * Nhận File object, convert sang base64 rồi upload
 */
export async function uploadFileToImgBB(file: File): Promise<ImgBBResponse> {
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const name = file.name.replace(/\.[^.]+$/, '') // bỏ extension
  return uploadToImgBB(base64, name)
}
```

### 1.3 Tạo Server Action cho Product Image

**File:** `src/app/dashboard/products/actions.ts` — Thêm function:

```typescript
export async function uploadProductImage(
  productId: string,
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const file = formData.get('image') as File
    if (!file || file.size === 0) return { success: false, error: 'No file provided' }

    // Validate
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) return { success: false, error: 'File quá lớn (max 10MB)' }
    if (!file.type.startsWith('image/')) return { success: false, error: 'Chỉ chấp nhận file ảnh' }

    // Upload to ImgBB
    const result = await uploadFileToImgBB(file)
    if (!result.success) return { success: false, error: result.error?.message ?? 'Upload failed' }

    // Lưu URL vào DB
    await prisma.product.update({
      where: { id: productId },
      data: {
        imageUrl: result.data!.display_url,
        // Lưu delete_url để sau cần xóa
        // imageDeleteUrl: result.data!.delete_url,
      },
    })

    revalidatePath('/dashboard/products')
    return { success: true, url: result.data!.display_url }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
```

### 1.4 UI Component — Image Uploader

**File:** `src/components/ImageUploader.tsx`

```tsx
'use client'

import { useState, useRef } from 'react'
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react'

interface ImageUploaderProps {
  currentUrl?: string | null
  onUpload: (formData: FormData) => Promise<{ success: boolean; url?: string; error?: string }>
  label?: string
}

export function ImageUploader({ currentUrl, onUpload, label = 'Ảnh sản phẩm' }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview ngay lập tức
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('image', file)

    const result = await onUpload(formData)
    setUploading(false)

    if (result.success && result.url) {
      setPreview(result.url)
    } else {
      setError(result.error ?? 'Upload thất bại')
      setPreview(currentUrl ?? null) // Revert
    }
  }

  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5"
        style={{ color: '#4A6A7A' }}>{label}</label>

      {preview ? (
        <div className="relative group rounded-lg overflow-hidden"
          style={{ width: 200, height: 200, background: '#1B2E3D' }}>
          <img src={preview} alt="" className="w-full h-full object-cover" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(10,25,38,0.7)' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
            </div>
          )}
          <button onClick={() => { setPreview(null); inputRef.current!.value = '' }}
            className="absolute top-2 right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
            style={{ background: 'rgba(139,26,46,0.8)', color: '#fff' }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-lg transition-colors"
          style={{ width: 200, height: 200, background: '#1B2E3D', border: '2px dashed #2A4355', color: '#4A6A7A' }}>
          <ImageIcon size={32} />
          <span className="text-xs">Click để upload ảnh</span>
        </button>
      )}

      {error && <p className="text-xs mt-1" style={{ color: '#8B1A2E' }}>{error}</p>}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
```

### 1.5 Schema Update (nếu cần)

Kiểm tra `prisma/schema.prisma` — model Product có thể đã có `imageUrl`. Nếu chưa:

```prisma
model Product {
  // ... existing fields ...
  imageUrl       String?    // URL ảnh từ ImgBB
  imageDeleteUrl String?    // URL xóa ảnh (từ ImgBB response)
}
```

Chạy migration:
```bash
npx prisma migrate dev --name add_product_image_url
```

---

## Phần 2: Supabase Storage — Hợp Đồng & Chứng Từ

### 2.1 Tạo Bucket trên Supabase Dashboard

1. Vào **Supabase Dashboard** → **Storage**
2. Tạo bucket mới:

| Bucket | Quyền | Mục đích |
|--------|-------|----------|
| `contracts` | **Private** | Hợp đồng, phụ lục |
| `invoices` | **Private** | Hóa đơn, chứng từ |
| `documents` | **Private** | Tài liệu chung |

3. Setup RLS Policy (mẫu):

```sql
-- Cho phép authenticated users upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('contracts', 'invoices', 'documents'));

-- Cho phép authenticated users đọc
CREATE POLICY "Authenticated users can read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id IN ('contracts', 'invoices', 'documents'));
```

### 2.2 Upload Service

**File:** `src/lib/supabase-storage.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role cho server-side
)

export type StorageBucket = 'contracts' | 'invoices' | 'documents'

/**
 * Upload file lên Supabase Storage
 * @returns Public URL hoặc Signed URL (cho private buckets)
 */
export async function uploadToStorage(
  bucket: StorageBucket,
  filePath: string,      // VD: 'CNT-001/contract_signed.pdf'
  file: File | Buffer,
  contentType?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      contentType: contentType ?? 'application/pdf',
      upsert: true, // Ghi đè nếu đã tồn tại
    })

  if (error) return { success: false, error: error.message }

  // Tạo signed URL (có thời hạn, bảo mật)
  const { data: signedData } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, 60 * 60 * 24 * 365) // 1 năm

  return {
    success: true,
    url: signedData?.signedUrl ?? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${data.path}`,
  }
}

/**
 * Xóa file từ Storage
 */
export async function deleteFromStorage(
  bucket: StorageBucket,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([filePath])

  return error ? { success: false, error: error.message } : { success: true }
}

/**
 * Lấy signed URL cho file private
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  filePath: string,
  expiresIn = 3600 // 1 giờ
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn)

  return data?.signedUrl ?? null
}
```

### 2.3 Tích hợp vào Contract Upload (đã có)

Module Contracts đã có `uploadContractDocument()` trong `contracts/actions.ts`. Cập nhật để dùng Supabase Storage thay vì cách hiện tại:

```typescript
// Trong contracts/actions.ts
import { uploadToStorage } from '@/lib/supabase-storage'

export async function uploadContractDocument(
  contractId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const file = formData.get('file') as File
  if (!file) return { success: false, error: 'No file' }

  // Upload to Supabase Storage
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { contractNo: true },
  })

  const filePath = `${contract?.contractNo ?? contractId}/${Date.now()}_${file.name}`
  const result = await uploadToStorage('contracts', filePath, file, file.type)

  if (!result.success) return { success: false, error: result.error }

  // Lưu document record vào DB
  await prisma.contractDocument.create({
    data: {
      contractId,
      name: file.name,
      fileUrl: result.url!,
      storagePath: filePath, // Lưu path để xóa sau
      fileSize: file.size,
      mimeType: file.type,
    },
  })

  revalidatePath('/dashboard/contracts')
  return { success: true }
}
```

---

## Phần 3: Environment Variables

### Local Development (`.env.local`)

```env
# ImgBB — Ảnh sản phẩm
IMGBB_API_KEY=your_imgbb_api_key

# Supabase — Đã có sẵn, thêm nếu chưa
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # Cần cho server-side storage upload
```

### Vercel Production

Vào **Vercel Dashboard** → **Settings** → **Environment Variables**, thêm:
- `IMGBB_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (nếu chưa có)

---

## Phần 4: Modules Cần Tích Hợp

| Module | Loại file | Service | DB Field | Priority |
|--------|-----------|---------|----------|----------|
| **Products** | Ảnh SP | ImgBB | `Product.imageUrl` | 🔴 Cao |
| **Contracts** | PDF hợp đồng | Supabase Storage | `ContractDocument.fileUrl` | 🔴 Cao |
| **Procurement** | Invoice PDF | Supabase Storage | `PurchaseOrder.invoiceUrl` | 🟡 TB |
| **Delivery** | E-POD ảnh | ImgBB | `DeliveryOrder.podImageUrl` | 🟡 TB |
| **QR Codes** | QR image | ImgBB (hoặc generate on-fly) | `Product.qrImageUrl` | 🟢 Thấp |

---

## Phần 5: Checklist Triển Khai

### Bước 1: Setup (15 phút)
- [ ] Đăng ký ImgBB API key tại https://api.imgbb.com/
- [ ] Thêm `IMGBB_API_KEY` vào `.env.local`
- [ ] Tạo Supabase Storage buckets (`contracts`, `invoices`, `documents`)
- [ ] Setup RLS policies cho buckets
- [ ] Thêm `SUPABASE_SERVICE_ROLE_KEY` vào `.env.local`

### Bước 2: Code Service Layer (20 phút)
- [ ] Tạo `src/lib/imgbb.ts`
- [ ] Tạo `src/lib/supabase-storage.ts`
- [ ] Cập nhật schema nếu cần (`imageUrl` fields)
- [ ] Chạy `npx prisma migrate dev`

### Bước 3: Tích Hợp Products (30 phút)
- [ ] Tạo `uploadProductImage()` server action
- [ ] Tạo `ImageUploader` component
- [ ] Thêm uploader vào Product Drawer (tạo/sửa SP)
- [ ] Hiển thị ảnh trong Product Table
- [ ] Test upload + hiển thị

### Bước 4: Tích Hợp Contracts (20 phút)
- [ ] Cập nhật `uploadContractDocument()` dùng Supabase Storage
- [ ] Test upload PDF + xem file
- [ ] Test signed URL expiration

### Bước 5: Deploy (10 phút)
- [ ] Thêm env vars vào Vercel
- [ ] Push code
- [ ] Test trên production

---

## Giới Hạn & Lưu Ý

### ImgBB
- **Max file size:** 32MB/ảnh
- **Supported formats:** JPEG, PNG, GIF, BMP, WebP, TIFF
- **Không xóa qua API dễ dàng** — lưu `delete_url` vào DB
- **Không có SLA** — nếu ImgBB down, ảnh không load (nhưng data trong DB vẫn an toàn)

### Supabase Storage
- **Free tier:** 1GB storage, 2GB bandwidth/tháng
- **Max upload:** 50MB/file (free tier)
- **Signed URL:** Nên set expire 1 năm cho documents cần truy cập lâu dài
- **Service Role Key:** KHÔNG BAO GIỜ expose ra client — chỉ dùng server-side

### Quy tắc chung
- ✅ Validate file type + size ở **cả client và server**
- ✅ Lưu **cả URL và storage path** vào DB (để xóa sau)
- ✅ Dùng `try/catch` cho mọi upload — network có thể fail
- ❌ KHÔNG lưu file vào `public/` folder của Next.js
- ❌ KHÔNG store base64 trong database
