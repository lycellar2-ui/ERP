# Remotion Video Studio — Wine ERP

Hệ thống lập trình và xuất bản video hướng dẫn nghiệp vụ chuẩn SaaS bằng mã nguồn React và Remotion.

---

## 1. Cấu Trúc Thư Mục

```
remotion-studio/
├── src/
│   ├── components/
│   │   ├── BrowserFrame.tsx     # Khung trình duyệt macOS cao cấp
│   │   ├── MouseCursor.tsx      # Con trỏ chuột mô phỏng chuyển động & hiệu ứng click
│   │   ├── StepIndicator.tsx    # Thanh tiến trình từng bước ở chân trang
│   │   └── CalloutCard.tsx      # Thẻ hướng dẫn thao tác & quy tắc nghiệp vụ
│   ├── scenes/
│   │   ├── IntroScene.tsx           # Giới thiệu phân hệ & quy trình
│   │   ├── Step1CustomerScene.tsx   # Bước 1: Chọn khách hàng & kiểm tra hạn mức nợ
│   │   ├── Step2ProductScene.tsx    # Bước 2: Thêm rượu vang & tự động tính giá
│   │   ├── Step3DeliveryScene.tsx   # Bước 3: Thiết lập kho xuất & lịch giao hàng
│   │   ├── Step4ConfirmScene.tsx    # Bước 4: Kiểm tra tổng tiền & duyệt đơn hàng
│   │   └── OutroScene.tsx           # Tổng kết 3 nguyên tắc cốt lõi khi tạo đơn
│   ├── OrderTutorial/
│   │   └── index.tsx            # Composition ghép toàn bộ các cảnh
│   ├── Root.tsx                 # Đăng ký Composition (1920x1080 @ 30fps, 43s)
│   └── index.ts                 # Điểm khởi chạy của Remotion
├── out/                         # Thư mục chứa video MP4 và ảnh snapshot render
├── remotion.config.ts           # Cấu hình render & OpenGL
└── package.json
```

---

## 2. Các Lệnh Sử Dụng

### Xem Trước Trực Quan Trên Trình Duyệt (Hot Reloading)
```bash
npm start
```
Lệnh này khởi động **Remotion Studio** tại địa chỉ `http://localhost:3000`. Bạn có thể tua timeline, xem từng frame, phóng to thu nhỏ và chỉnh sửa code trực tiếp mà video tự động cập nhật ngay lập tức.

### Xuất Video Thành Phẩm (MP4 H.264)
```bash
npm run render
```
Video xuất ra tại: `out/order-tutorial.mp4` với độ phân giải Full HD 1080p, 30fps.

### Xuất Ảnh Từng Khung Hình (Snapshot)
```bash
npx remotion still src/index.ts OrderTutorial out/step1.png --frame 200
```

---

## 3. Cách Kết Hợp Với Video Quay Màn Hình Thực Tế

Nếu bạn muốn chuyển sang dạng **Video quay màn hình thật được Remotion biên tập hậu kỳ**:

1. Đặt file quay màn hình vào thư mục `public/` (ví dụ: `public/real-order-recording.mp4`).
2. Trong component cảnh, import `Video` và `staticFile` từ `remotion`:
   ```tsx
   import { Video, staticFile, interpolate, useCurrentFrame } from 'remotion';

   export const RealScreenScene = () => {
     const frame = useCurrentFrame();
     // Dynamic Zoom vào vị trí nhập liệu
     const scale = interpolate(frame, [0, 60], [1, 1.4]);
     
     return (
       <div style={{ transform: `scale(${scale})`, transformOrigin: '20% 30%' }}>
         <Video src={staticFile('real-order-recording.mp4')} />
       </div>
     );
   };
   ```
