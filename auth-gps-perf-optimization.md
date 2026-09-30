# Kế Hoạch Tối Ưu Phiên Đăng Nhập Lâu Dài, GPS Thời Gian Thực Không Hỏi Lặp Lại & Khử Lag Hệ Thống

## 1. Yêu Cầu Cốt Lõi Từ Người Dùng
1. **Duy trì đăng nhập lâu:** Cấu hình phiên đăng nhập dài hạn (365 ngày), không bắt đăng nhập lại mỗi khi mở trình duyệt/tắt app.
2. **Không có cơ chế lấy toạ độ gần nhất:** Tuyệt đối không dùng toạ độ cũ/gần nhất để fallback. Toạ độ check-in phải là toạ độ thực tế thời gian thực tại điểm bán.
3. **Không hỏi lại GPS ở mỗi địa điểm:** Sử dụng `watchPosition` liên tục trong phiên để trình duyệt ghi nhận quyền 1 lần duy nhất, toạ độ luôn được cập nhật theo vị trí thực tế mà không pop-up xin quyền lặp đi lặp lại.
4. **Khử lag triệt để:** Bỏ blocking reverse geocoding lúc bấm lưu ảnh; giải phóng stream camera ngay khi chụp; tối ưu hoá luồng dữ liệu.

## 2. Các Tệp Cần Chỉnh Sửa
- `wine-erp/src/middleware.ts`:
  - Nâng timeout xác thực từ 800ms lên 4000ms để đảm bảo refresh token qua 4G không bao giờ bị ngắt quãng.
  - Cấu hình cookie lưu trữ lâu dài `maxAge: 31,536,000` (1 năm).
- `wine-erp/src/lib/supabase.ts`:
  - Cấu hình `cookieOptions` với `maxAge: 31536000` (365 ngày), `sameSite: 'lax'`, `secure: production`.
- `wine-erp/src/app/login/actions.ts` & `wine-erp/src/app/login/page.tsx`:
  - Đảm bảo session cookie được lưu dài hạn khi `signInWithPassword`.
- `wine-erp/src/app/dashboard/sales/visits/SalesVisitsClient.tsx`:
  - Triển khai `navigator.geolocation.watchPosition` theo thời gian thực (real-time stream).
  - Khi người dùng ở trang check-in, GPS cập nhật liên tục toạ độ thực tế mới nhất.
  - Khi bấm chụp ảnh và xác nhận check-in: lấy toạ độ thực tế tức thời từ GPS watcher (không cold-start `getCurrentPosition` 10s, không hỏi lại quyền).
  - Không chặn reverse geocoding: gửi `lat`, `lng` ngay cho Server Action, địa chỉ được xử lý ngầm hoặc hiển thị toạ độ số ngay tức khắc.
  - Ngắt stream camera ngay khi bấm chụp ảnh để giải phóng GPU/bộ nhớ di động, chống nóng máy và lag.
- `wine-erp/src/app/dashboard/sales/visits/LiveCameraModal.tsx`:
  - Đảm bảo `stopActiveStream()` được gọi dứt điểm ngay sau khi chụp ảnh.
- `docs/modules/sales-field-visit.md`: Cập nhật tài liệu kỹ thuật.

## 3. Tiêu Chí Kiểm Tra (Verification)
- TypeScript compile thành công 0 lỗi.
- Đăng nhập duy trì cookie `maxAge = 365 ngày`.
- GPS hoạt động theo thời gian thực, không hỏi lại quyền sau lần đầu tiên, không dùng toạ độ cũ.
- Tốc độ hoàn tất check-in mượt mà, phản hồi tức thời.
