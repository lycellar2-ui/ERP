# Video Guides (R2 Streaming & Screen-Based Hub) — Implementation Plan

- **Project Type:** WEB (Next.js 16 App Router + Prisma + Cloudflare R2)
- **Route:** `/dashboard/guides`
- **Sidebar Placement:** Bottom footer of `Sidebar.tsx`, directly above the Language Switcher (`Ngôn ngữ`) and Logout (`Đăng Xuất`).

## 1. Database Schema (`wine-erp/prisma/schema.prisma`)
- Add `VideoGuide` model (`@@map("video_guides")`):
  - `id`, `screenKey`, `screenLabel`, `title`, `description`, `storagePath`, `fileName`, `fileSize`, `mimeType`, `durationSec`, `sortOrder`, `isPublished`, `uploadedById`, `uploadedByName`, `createdAt`, `updatedAt`.

## 2. Cloudflare R2 Upload & Video Streaming
- `wine-erp/src/lib/storage-r2.ts`:
  - Add `getVideoGuidePresignedUploadUrl` supporting video MIME types (`mp4`, `webm`, `mov`, `m4v`) up to 500MB under `video-guides/{screenKey}/{timestamp}_{safeName}`.
  - Add `deleteR2Object` helper.
- `wine-erp/src/app/api/r2-file/[...path]/route.ts`:
  - Add video MIME type inference (`mp4`, `webm`, `mov`, `m4v`, `ogg`).
  - For video files or `Range` requests, bypass `transformToByteArray()` in-memory buffering and `302` redirect to the presigned R2 GET URL (or `R2_PUBLIC_DOMAIN`) for native byte-range seeking and streaming.

## 3. Module `/dashboard/guides`
- `constants.ts`: Predefined ERP screen categories (`GUIDE_SCREENS`) with bilingual VI/EN labels.
- `actions.ts`: Server actions for listing guides, generating presigned PUT URLs, creating/updating/deleting guides (restricted to Admin/CEO/BOD/Assistant roles for mutations; all authenticated users can view).
- `page.tsx` & `GuidesClient.tsx`:
  - Screen-segmented layout: screen selector list (with video counts) + search bar + inline HTML5 `<video>` player + screen playlist.
  - Admin upload modal with XHR progress bar directly to R2 Presigned URL and automatic video duration extraction.

## 4. Sidebar & Docs Sync
- `wine-erp/src/components/layout/Sidebar.tsx`: Add compact "Hướng dẫn sử dụng" / "Video Guides" link above the Language Switcher.
- Sync `docs/modules/guides.md`, `docs/README.md`, `docs/llms.txt`, and `CODEBASE.md`.
