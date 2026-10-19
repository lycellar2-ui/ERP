import React from 'react';
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { CameraViewport } from '../components/CameraViewport';
import { MouseCursor } from '../components/MouseCursor';
import { CalloutCard } from '../components/CalloutCard';
import { HighlightBox } from '../components/HighlightBox';

export const RealStep4ConfirmScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Exact DOM coordinates:
  // submitBtn: { x: 1475, y: 852, width: 105, height: 36, cx: 1527, cy: 870 }
  // printBtn: { x: 660, y: 852, width: 120, height: 36, cx: 720, cy: 870 }

  const zoomIn = spring({
    frame: frame - 12,
    fps,
    config: { damping: 24, stiffness: 80 },
  });
  const zoomOut = spring({
    frame: frame - 155,
    fps,
    config: { damping: 24, stiffness: 85 },
  });

  const scale = interpolate(zoomIn - zoomOut * 0.85, [0, 1], [1, 1.26], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const focalX = interpolate(zoomIn, [0, 1], [800, 1180], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const focalY = interpolate(zoomIn, [0, 1], [450, 740], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Transition from step4-order-complete.png to step4b-order-summary.png (scrolled down to reveal VAT & Grand Total)
  const summaryOpacity = interpolate(frame, [20, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isSubmitted = frame >= 128;
  const toastProgress = spring({
    frame: frame - 130,
    fps,
    config: { damping: 16, stiffness: 130 },
  });

  return (
    <AbsoluteFill>
      <CameraViewport scale={scale} focalX={focalX} focalY={focalY}>
        <Img
          src={staticFile('step4-order-complete.png')}
          style={{ width: 1600, height: 900, display: 'block' }}
        />

        {summaryOpacity > 0 && (
          <Img
            src={staticFile('step4b-order-summary.png')}
            style={{
              position: 'absolute',
              inset: 0,
              width: 1600,
              height: 900,
              opacity: summaryOpacity,
            }}
          />
        )}

        {/* Highlight 1: VAT & Grand Total Calculation Card */}
        <HighlightBox
          x={662}
          y={675}
          width={916}
          height={155}
          startFrame={34}
          endFrame={105}
          label="Tổng Thanh Toán (Gồm 10% VAT): 22.968.000 đ"
          labelPosition="top"
          color="#0EA5E9"
          borderRadius={8}
        />

        {/* Highlight 2: Submit "Tạo Đơn" Button */}
        <HighlightBox
          x={1475}
          y={852}
          width={105}
          height={36}
          startFrame={92}
          endFrame={130}
          label="Nhấn Tạo Đơn để hoàn tất"
          labelPosition="top"
          color="#10B981"
          borderRadius={8}
        />

        <MouseCursor
          keyframes={[
            { frame: 0, x: 1220, y: 650 },
            { frame: 55, x: 1350, y: 785 },
            { frame: 108, x: 1527, y: 870 },
            { frame: 126, x: 1527, y: 870, click: true },
            { frame: 165, x: 1380, y: 740 },
          ]}
          cameraScale={scale}
        />
      </CameraViewport>

      {/* Success Notification Banner after clicking Tạo Đơn */}
      {isSubmitted && (
        <div
          style={{
            position: 'absolute',
            top: 28,
            right: 36,
            transform: `translateY(${interpolate(toastProgress, [0, 1], [-24, 0])}px) scale(${interpolate(toastProgress, [0, 1], [0.94, 1])})`,
            opacity: toastProgress,
            backgroundColor: 'rgba(13, 27, 23, 0.96)',
            border: '1px solid #10B981',
            borderLeft: '4px solid #10B981',
            borderRadius: 12,
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 24px 50px rgba(0, 0, 0, 0.65), 0 0 28px rgba(16, 185, 129, 0.25)',
            zIndex: 85,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: 'rgba(16, 185, 129, 0.18)',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 6L9 17L4 12"
                stroke="#34D399"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#ECFDF5', marginBottom: 3 }}>
              Đã khởi tạo thành công Đơn bán hàng #SO-2610-0010
            </div>
            <div style={{ fontSize: 12.5, color: '#A7F3D0', fontWeight: 500 }}>
              Khách hàng: Fabrik Restaurant • Tổng cộng: 22.968.000 ₫ • Đã giữ chỗ 18 chai tại kho
            </div>
          </div>
        </div>
      )}

      {/* Callout Card on the left dimmed backdrop */}
      <CalloutCard
        stepNumber="BƯỚC 04 / 04"
        title="Kiểm tra Tổng tiền VAT & Hoàn tất Đơn"
        description="Hệ thống tự động tổng hợp Tiền hàng trước thuế (20.880.000 đ), Thuế VAT 10% (2.088.000 đ) và Tổng thanh toán. Bạn có thể nhấn 'Xem File In' hoặc 'Tạo Đơn' để lưu và giữ chỗ tồn kho."
        badgeText="Tổng cộng: 22.968.000 ₫ (Gồm VAT)"
        keyTakeaway="Đơn vượt ngưỡng chiết khấu sẽ tự động chuyển sang trình duyệt"
        startFrame={10}
        endFrame={200}
        position={{ bottom: 28, left: 28 }}
        width={410}
      />
    </AbsoluteFill>
  );
};
